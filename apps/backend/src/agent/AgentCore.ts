import { v4 as uuidv4 } from "uuid";
import { createHash } from "crypto";
import { eq } from "drizzle-orm";
import { Server } from "socket.io";
import { Task, ReasoningStep, ProviderName, TaskCreateInput, PROVIDERS } from "@pot/shared";
import { db } from "../db";
import { tasks, attestations, comparisonResults, type TaskUpdate, type ComparisonUpdate } from "../schema";
import { DecisionEngine } from "./DecisionEngine";
import { GeminiProProvider } from "./GeminiProProvider";
import { GeminiFlashProvider } from "./GeminiFlashProvider";
import { ClaudeProvider } from "./ClaudeProvider";
import { OpenAIProvider } from "./OpenAIProvider";
import { DeepSeekProvider } from "./DeepSeekProvider";
import { MockProvider } from "./MockProvider";
import { KiteClient } from "../blockchain/KiteClient";

type Provider = GeminiProProvider | GeminiFlashProvider | ClaudeProvider | OpenAIProvider | DeepSeekProvider | MockProvider;

interface Subtask {
  title: string;
  instruction: string;
}

interface SubAttestationNode {
  index: number;
  title: string;
  provider: ProviderName;
  hash: string; // SHA-256 of this subtask's reasoning
  costUsd: number;
  tokensUsed: number;
}

/**
 * Compute Merkle root from an array of leaf hashes.
 * Creates a binary tree where each parent = SHA256(left + right).
 */
function computeMerkleRoot(leafHashes: string[]): { root: string; tree: string[][] } {
  if (leafHashes.length === 0) return { root: "0x0", tree: [] };
  if (leafHashes.length === 1) return { root: leafHashes[0], tree: [leafHashes] };

  const tree: string[][] = [leafHashes];
  let currentLevel = leafHashes;

  while (currentLevel.length > 1) {
    const nextLevel: string[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = currentLevel[i + 1] ?? left; // duplicate last if odd
      const parent = createHash("sha256")
        .update(left + right)
        .digest("hex");
      nextLevel.push(`0x${parent}`);
    }
    tree.push(nextLevel);
    currentLevel = nextLevel;
  }

  return { root: currentLevel[0], tree };
}

export class AgentCore {
  private decisionEngine: DecisionEngine;
  private providers: Map<ProviderName, Provider>;
  private kiteClient: KiteClient | null;
  private io: Server;

  constructor(io: Server) {
    this.io = io;
    this.decisionEngine = new DecisionEngine();
    this.providers = new Map();

    // Initialize providers
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      this.providers.set("gemini-pro", new GeminiProProvider(geminiKey));
      this.providers.set("gemini-flash", new GeminiFlashProvider(geminiKey));
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicKey) {
      this.providers.set("claude-sonnet", new ClaudeProvider(anthropicKey));
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
      this.providers.set("gpt-4o", new OpenAIProvider(openaiKey));
    }

    const deepseekKey = process.env.DEEPSEEK_API_KEY;
    if (deepseekKey) {
      this.providers.set("deepseek-chat", new DeepSeekProvider(deepseekKey));
    }

    this.providers.set("mock", new MockProvider());

    // Initialize blockchain client
    const privateKey = process.env.PRIVATE_KEY;
    const contractAddress = process.env.PROOF_OF_THOUGHT_CONTRACT;
    if (privateKey && contractAddress) {
      this.kiteClient = new KiteClient(privateKey, contractAddress);
    } else {
      this.kiteClient = null;
      console.warn("Blockchain client not initialized: missing PRIVATE_KEY or PROOF_OF_THOUGHT_CONTRACT");
    }
  }

  private async decomposeTask(
    taskType: string,
    input: string
  ): Promise<{ reasoning: string; subtasks: Subtask[] } | null> {
    const flashProvider = this.providers.get("gemini-flash") as GeminiFlashProvider | undefined;
    if (!flashProvider) return null;

    const typeLabel = taskType === "custom" ? "custom" : taskType;
    const prompt = `You are a task planner. Break the following ${typeLabel} task into 2-4 sequential subtasks.

Task input:
${input}

Respond ONLY with valid JSON in this exact format (no markdown, no code fences):
{
  "reasoning": "Brief explanation of why you chose this decomposition",
  "subtasks": [
    { "title": "Short title", "instruction": "Specific instruction for this subtask" }
  ]
}`;

    try {
      const { result } = await flashProvider.execute("text-generation" as any, prompt);
      // Try to extract JSON from the response
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]);
      if (!parsed.subtasks || !Array.isArray(parsed.subtasks) || parsed.subtasks.length < 2) {
        return null;
      }
      // Cap at 4 subtasks
      parsed.subtasks = parsed.subtasks.slice(0, 4);
      return parsed;
    } catch {
      return null;
    }
  }

  async executeTask(taskInput: TaskCreateInput): Promise<string> {
    const taskId = taskInput.taskId || uuidv4();
    const reasoningSteps: ReasoningStep[] = [];
    let stepCount = 0;

    const addStep = (action: string, description: string, data?: Record<string, unknown>) => {
      const step: ReasoningStep = {
        id: uuidv4(),
        taskId,
        step: stepCount++,
        action,
        description,
        data,
        timestamp: new Date().toISOString(),
      };
      reasoningSteps.push(step);
      this.io.emit("attestation:step", { taskId, step });
      return step;
    };

    try {
      // Step 1: Create task in DB (onConflictDoNothing for retries where row is pre-created)
      await db
        .insert(tasks)
        .values({
          id: taskId,
          type: taskInput.type,
          input: taskInput.input,
          maxCostUsd: taskInput.maxCostUsd,
          status: "pending",
          paymentStatus: "none",
          ...(taskInput.fileName ? { fileName: taskInput.fileName } : {}),
          ...(taskInput.fileContent ? { fileContent: taskInput.fileContent } : {}),
        } as typeof tasks.$inferInsert)
        .onConflictDoNothing();
      this.io.emit("task:update", { taskId, status: "pending" });

      addStep("task-received", `Received ${taskInput.type} task`, {
        type: taskInput.type,
        inputLength: taskInput.input.length,
        maxCostUsd: taskInput.maxCostUsd,
      });

      // Step 2: Discover providers
      await db.update(tasks).set({ status: "selecting-provider" } as TaskUpdate).where(eq(tasks.id, taskId));
      this.io.emit("task:update", { taskId, status: "selecting-provider" });

      const availableProviders = Array.from(this.providers.keys()).filter((p) => p !== "mock");
      addStep("discover-providers", `Found ${availableProviders.length} available providers`, {
        providers: availableProviders,
      });

      // Step 3: Score providers
      const scores = this.decisionEngine.scoreProviders(
        taskInput.type,
        taskInput.maxCostUsd,
        taskInput.input.length
      );

      addStep("score-providers", "Evaluated providers using weighted scoring", {
        scores: scores.map((s) => ({
          provider: s.provider,
          totalScore: Math.round(s.totalScore * 100) / 100,
          costScore: Math.round(s.costScore * 100) / 100,
          qualityScore: s.qualityScore,
          speedScore: Math.round(s.speedScore * 100) / 100,
          estimatedCost: `$${s.estimatedCostUsd.toFixed(6)}`,
        })),
        weights: { cost: "40%", quality: "40%", speed: "20%" },
      });

      // Step 4: Verify user escrow deposit
      const escrowTxHash = taskInput.escrowTxHash;
      if (escrowTxHash && taskInput.depositorAddress) {
        await db.update(tasks).set({ escrowTxHash, paymentStatus: "escrowed" } as TaskUpdate).where(eq(tasks.id, taskId));

        addStep("escrow-verified", `User deposited escrow via wallet`, {
          escrowTxHash,
          depositorAddress: taskInput.depositorAddress,
          amount: `${taskInput.maxCostUsd} USDT`,
          explorerUrl: `https://testnet.kitescan.ai/tx/${escrowTxHash}`,
        });
      } else {
        addStep("escrow-skipped", "No user escrow deposit provided");
      }

      // Step 5: Decompose task into subtasks
      const decomposition = await this.decomposeTask(taskInput.type, taskInput.input);

      await db.update(tasks).set({ status: "executing" } as TaskUpdate).where(eq(tasks.id, taskId));
      this.io.emit("task:update", { taskId, status: "executing" });

      let result: string;
      let totalTokensUsed = 0;
      let totalActualCost = 0;
      let selectedProvider: ProviderName;

      // Determine if user requested a specific provider
      let preferredProvider = taskInput.preferredProvider;
      if (preferredProvider) {
        if (this.providers.has(preferredProvider) && preferredProvider !== "mock") {
          addStep("provider-override", `User requested provider: ${preferredProvider}`, {
            preferredProvider,
          });
        } else {
          // Provider not available — notify and fall back to auto-selection
          const fallback = scores.find((s) => this.providers.has(s.provider) && s.provider !== "mock");
          addStep("provider-fallback", `Requested provider "${preferredProvider}" is not available. Falling back to ${fallback?.provider ?? "best available"}.`, {
            requestedProvider: preferredProvider,
            fallbackProvider: fallback?.provider,
            reason: "API key not configured for requested provider",
          });
          this.io.emit("task:update", {
            taskId,
            status: "selecting-provider",
            providerFallback: {
              requested: preferredProvider,
              actual: fallback?.provider,
              message: `${preferredProvider} is not available. Switching to ${fallback?.provider ?? "best available provider"}.`,
            },
          });
          preferredProvider = undefined;
        }
      }

      if (decomposition && decomposition.subtasks.length >= 2) {
        // Multi-step execution with sub-attestation chain
        addStep("task-decomposed", `Decomposed task into ${decomposition.subtasks.length} subtasks`, {
          reasoning: decomposition.reasoning,
          subtasks: decomposition.subtasks.map((s, i) => `${i + 1}. ${s.title}`),
          subtaskCount: decomposition.subtasks.length,
        });

        const subtaskResults: string[] = [];
        const subAttestationNodes: SubAttestationNode[] = [];

        for (let i = 0; i < decomposition.subtasks.length; i++) {
          const subtask = decomposition.subtasks[i];

          // Use preferred provider if set, otherwise score
          let subtaskProvider: ProviderName;
          if (preferredProvider && this.providers.has(preferredProvider)) {
            subtaskProvider = preferredProvider;
          } else {
            const subtaskScores = this.decisionEngine.scoreProviders(
              taskInput.type,
              taskInput.maxCostUsd,
              subtask.instruction.length
            );
            const bestScore = subtaskScores.find((s) => this.providers.has(s.provider))!;
            subtaskProvider = bestScore.provider;
          }

          addStep("subtask-start", `Starting subtask ${i + 1}/${decomposition.subtasks.length}: ${subtask.title}`, {
            subtaskIndex: i + 1,
            title: subtask.title,
            provider: subtaskProvider,
          });

          const provider = this.providers.get(subtaskProvider)!;

          // Update selected provider on first subtask
          if (i === 0) {
            selectedProvider = subtaskProvider;
            await db.update(tasks).set({ selectedProvider } as TaskUpdate).where(eq(tasks.id, taskId));
            this.io.emit("task:update", { taskId, status: "executing", selectedProvider });
          }

          const startTime = Date.now();
          const contextPrefix = i > 0
            ? `Previous context:\n${subtaskResults.slice(-1)[0]?.substring(0, 500)}\n\nNow: `
            : "";
          const { result: subtaskResult, tokensUsed } = await provider.execute(
            taskInput.type,
            contextPrefix + subtask.instruction
          );
          const executionTime = Date.now() - startTime;

          const subtaskCost = (tokensUsed / 1000) * (provider.config?.costPer1kTokens ?? 0);
          totalTokensUsed += tokensUsed;
          totalActualCost += subtaskCost;

          subtaskResults.push(subtaskResult);

          // Compute sub-attestation hash for this subtask
          const subtaskData = JSON.stringify({
            index: i,
            title: subtask.title,
            provider: subtaskProvider,
            input: subtask.instruction.substring(0, 200),
            resultHash: createHash("sha256").update(subtaskResult).digest("hex"),
            tokensUsed,
            costUsd: subtaskCost,
          });
          const subtaskHash = `0x${createHash("sha256").update(subtaskData).digest("hex")}`;

          subAttestationNodes.push({
            index: i,
            title: subtask.title,
            provider: subtaskProvider,
            hash: subtaskHash,
            costUsd: subtaskCost,
            tokensUsed,
          });

          addStep("subtask-complete", `Completed subtask ${i + 1}: ${subtask.title}`, {
            subtaskIndex: i + 1,
            title: subtask.title,
            provider: subtaskProvider,
            tokensUsed,
            executionTimeMs: executionTime,
            costUsd: `$${subtaskCost.toFixed(6)}`,
            subAttestationHash: subtaskHash,
            resultPreview: subtaskResult.substring(0, 200),
          });
        }

        // Build Merkle tree from sub-attestation hashes
        const leafHashes = subAttestationNodes.map((n) => n.hash);
        const { root: merkleRoot, tree: merkleTree } = computeMerkleRoot(leafHashes);

        addStep("merkle-tree-computed", `Built Merkle reasoning tree from ${subAttestationNodes.length} sub-attestations`, {
          merkleRoot,
          leafHashes,
          treeDepth: merkleTree.length,
          subAttestations: subAttestationNodes.map((n) => ({
            index: n.index,
            title: n.title,
            provider: n.provider,
            hash: n.hash,
            costUsd: `$${n.costUsd.toFixed(6)}`,
          })),
        });

        addStep("cost-tracking", `Total execution cost: $${totalActualCost.toFixed(6)}`, {
          totalTokensUsed,
          totalCostUsd: `$${totalActualCost.toFixed(6)}`,
          subtaskCount: decomposition.subtasks.length,
          merkleRoot,
        });

        // Combine results
        result = decomposition.subtasks
          .map((s, i) => `## Step ${i + 1}: ${s.title}\n\n${subtaskResults[i]}`)
          .join("\n\n---\n\n");
      } else {
        // Single-step execution (fallback)
        const bestScore = scores.find((s) => this.providers.has(s.provider))!;
        if (preferredProvider && this.providers.has(preferredProvider)) {
          selectedProvider = preferredProvider;
        } else {
          selectedProvider = bestScore.provider;
        }

        addStep("select-provider", `Selected ${selectedProvider} (score: ${bestScore.totalScore.toFixed(2)})`, {
          selected: selectedProvider,
          reason: preferredProvider
            ? "User preferred provider"
            : bestScore.totalScore === scores[0].totalScore
              ? "Highest overall score"
              : "Best available provider",
        });

        await db.update(tasks).set({ selectedProvider } as TaskUpdate).where(eq(tasks.id, taskId));
        this.io.emit("task:update", { taskId, status: "executing", selectedProvider });

        addStep("execute-start", `Executing task with ${selectedProvider}...`);

        const provider = this.providers.get(selectedProvider)!;
        const startTime = Date.now();
        const execResult = await provider.execute(taskInput.type, taskInput.input);
        result = execResult.result;
        totalTokensUsed = execResult.tokensUsed;
        const executionTime = Date.now() - startTime;

        totalActualCost = (totalTokensUsed / 1000) * (provider.config?.costPer1kTokens ?? 0);

        addStep("execute-complete", `Task completed in ${executionTime}ms`, {
          tokensUsed: totalTokensUsed,
          executionTimeMs: executionTime,
          actualCost: `$${totalActualCost.toFixed(6)}`,
          resultPreview: result.substring(0, 200),
        });
      }

      // Record attestation + release payment on-chain
      await db.update(tasks).set({ status: "recording-attestation" } as TaskUpdate).where(eq(tasks.id, taskId));
      this.io.emit("task:update", { taskId, status: "recording-attestation" });

      const reasoningData = JSON.stringify(reasoningSteps);
      const reasoningHash = createHash("sha256").update(reasoningData).digest("hex");

      addStep("compute-hash", "Computed reasoning hash for on-chain attestation", {
        reasoningHash: `0x${reasoningHash}`,
        stepsCount: reasoningSteps.length,
      });

      let txHash: string | undefined;
      let blockNumber: number | undefined;

      if (this.kiteClient) {
        try {
          const chainResult = await this.kiteClient.completeTask(
            taskId,
            taskInput.type,
            `0x${reasoningHash}`,
            selectedProvider!,
            Math.round(totalActualCost * 1_000_000) // micro-USD
          );
          txHash = chainResult.txHash;
          blockNumber = chainResult.blockNumber;

          await db.update(tasks).set({ paymentTxHash: txHash, paymentStatus: "released" } as TaskUpdate).where(eq(tasks.id, taskId));

          addStep("attestation-recorded", "Attestation recorded on Kite blockchain", {
            txHash,
            blockNumber,
            explorerUrl: `https://testnet.kitescan.ai/tx/${txHash}`,
          });

          addStep("payment-released", "Escrowed USDT released to agent wallet", {
            paymentTxHash: txHash,
            amount: `${taskInput.maxCostUsd} USDT`,
            explorerUrl: `https://testnet.kitescan.ai/tx/${txHash}`,
          });
        } catch (err) {
          addStep("attestation-failed", `On-chain recording failed: ${err instanceof Error ? err.message : "Unknown error"}. Continuing with off-chain attestation.`);
        }
      } else {
        addStep("attestation-skipped", "Blockchain client not configured — attestation stored off-chain only");
      }

      // Store attestation in DB
      const attestationId = uuidv4();
      const agentAddress = this.kiteClient?.getAddress() ?? "0x0000000000000000000000000000000000000000";

      await db.insert(attestations).values({
        id: attestationId,
        taskId,
        taskType: taskInput.type,
        reasoningHash: `0x${reasoningHash}`,
        providerUsed: selectedProvider!,
        costUsd: totalActualCost,
        txHash: txHash ?? null,
        blockNumber: blockNumber ?? null,
        agentAddress,
        reasoningSteps: reasoningSteps,
      } as typeof attestations.$inferInsert);

      // Update task as completed
      await db
        .update(tasks)
        .set({ status: "completed", result, attestationId, completedAt: new Date() } as TaskUpdate)
        .where(eq(tasks.id, taskId));

      this.io.emit("task:update", { taskId, status: "completed" });
      this.io.emit("attestation:finalized", { taskId, attestationId, txHash });

      addStep("task-finalized", "Task completed and attestation finalized", {
        attestationId,
        txHash,
        escrowTxHash,
      });

      return taskId;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await db.update(tasks).set({ status: "failed", result: `Error: ${message}` } as TaskUpdate).where(eq(tasks.id, taskId));
      this.io.emit("task:update", { taskId, status: "failed", error: message });
      throw error;
    }
  }

  async executeComparison(taskInput: TaskCreateInput): Promise<string> {
    const taskId = taskInput.taskId || uuidv4();

    // Get all available providers (exclude mock)
    const availableProviders = Array.from(this.providers.keys()).filter((p) => p !== "mock");

    if (availableProviders.length === 0) {
      throw new Error("No AI providers available for comparison");
    }

    try {
      // Create parent task with compareMode
      await db
        .insert(tasks)
        .values({
          id: taskId,
          type: taskInput.type,
          input: taskInput.input,
          maxCostUsd: taskInput.maxCostUsd,
          status: "executing",
          paymentStatus: "none",
          compareMode: true,
          ...(taskInput.fileName ? { fileName: taskInput.fileName } : {}),
          ...(taskInput.fileContent ? { fileContent: taskInput.fileContent } : {}),
          ...(taskInput.escrowTxHash ? { escrowTxHash: taskInput.escrowTxHash, paymentStatus: "escrowed" } : {}),
        } as typeof tasks.$inferInsert)
        .onConflictDoNothing();

      this.io.emit("task:update", { taskId, status: "executing", compareMode: true });

      // Create comparison_results rows for each provider
      const comparisonIds: Map<ProviderName, string> = new Map();
      for (const providerName of availableProviders) {
        const compId = uuidv4();
        comparisonIds.set(providerName, compId);
        await db
          .insert(comparisonResults)
          .values({ id: compId, taskId, provider: providerName, status: "pending" } as typeof comparisonResults.$inferInsert);
      }

      // Run all providers in parallel
      const promises = availableProviders.map(async (providerName) => {
        const provider = this.providers.get(providerName)!;
        const compId = comparisonIds.get(providerName)!;

        // Emit start event
        await db.update(comparisonResults).set({ status: "executing" } as ComparisonUpdate).where(eq(comparisonResults.id, compId));
        this.io.emit("compare:provider-start", { taskId, provider: providerName });

        const startTime = Date.now();
        try {
          const { result, tokensUsed } = await provider.execute(taskInput.type, taskInput.input);
          const durationMs = Date.now() - startTime;
          const costUsd = (tokensUsed / 1000) * (provider.config?.costPer1kTokens ?? 0);

          await db.update(comparisonResults).set({
            status: "completed", result, tokensUsed, costUsd, durationMs, completedAt: new Date(),
          } as ComparisonUpdate).where(eq(comparisonResults.id, compId));

          this.io.emit("compare:provider-complete", {
            taskId,
            provider: providerName,
            result,
            tokensUsed,
            costUsd,
            durationMs,
          });
        } catch (err) {
          const durationMs = Date.now() - startTime;
          const errorMessage = err instanceof Error ? err.message : "Unknown error";

          await db.update(comparisonResults).set({
            status: "failed", error: errorMessage, durationMs, completedAt: new Date(),
          } as ComparisonUpdate).where(eq(comparisonResults.id, compId));

          this.io.emit("compare:provider-failed", {
            taskId,
            provider: providerName,
            error: errorMessage,
            durationMs,
          });
        }
      });

      await Promise.allSettled(promises);

      // Update parent task as completed
      await db.update(tasks).set({ status: "completed", completedAt: new Date() } as TaskUpdate).where(eq(tasks.id, taskId));

      this.io.emit("task:update", { taskId, status: "completed", compareMode: true });

      return taskId;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await db.update(tasks).set({ status: "failed", result: `Error: ${message}` } as TaskUpdate).where(eq(tasks.id, taskId));
      this.io.emit("task:update", { taskId, status: "failed", error: message });
      throw error;
    }
  }
}
