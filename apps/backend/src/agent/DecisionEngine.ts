import { ProviderName, ProviderScore, ProviderConfig, TaskType, CostEstimate, PROVIDERS, DECISION_WEIGHTS } from "@pot/shared";

export class DecisionEngine {
  scoreProviders(taskType: TaskType, maxCostUsd: number, inputLength: number): ProviderScore[] {
    const estimatedTokens = inputLength / 4 + 500; // rough: input tokens + ~500 output tokens
    const providerNames = (Object.keys(PROVIDERS) as ProviderName[]).filter((n) => n !== "mock");

    const scores = providerNames.map((name) => {
      const config = PROVIDERS[name];
      return this.scoreProvider(config, estimatedTokens, maxCostUsd);
    });

    // Sort by total score descending
    scores.sort((a, b) => b.totalScore - a.totalScore);
    return scores;
  }

  estimateTaskCost(taskType: TaskType, input: string): CostEstimate {
    const inputLength = input.length;

    // Estimate subtask count based on complexity heuristics
    let subtaskCount = 1;
    if (inputLength > 2000) subtaskCount = 4;
    else if (inputLength > 1000) subtaskCount = 3;
    else if (inputLength > 400) subtaskCount = 2;

    // For code-review and summarization, bump subtask count
    if ((taskType === "code-review" || taskType === "summarization") && subtaskCount < 2) {
      subtaskCount = 2;
    }

    const scores = this.scoreProviders(taskType, 1, inputLength);
    const bestProvider = scores[0];

    const breakdown = [];
    const subtaskLabels: Record<string, string[]> = {
      "text-generation": ["Research & outline", "Draft content", "Refine & polish", "Final review"],
      "translation": ["Analyze source text", "Translate content", "Review translation", "Quality check"],
      "code-review": ["Parse & understand code", "Identify issues", "Generate suggestions", "Compile report"],
      "summarization": ["Extract key points", "Draft summary", "Refine summary", "Final check"],
      "custom": ["Analyze requirements", "Execute task", "Refine output", "Final review"],
    };
    const labels = subtaskLabels[taskType] || ["Step 1", "Step 2", "Step 3", "Step 4"];

    let totalCost = 0;
    for (let i = 0; i < subtaskCount; i++) {
      // Each subtask processes a portion of the input plus overhead
      const subtaskTokens = (inputLength / subtaskCount) / 4 + 500;
      const subtaskCost = (subtaskTokens / 1000) * (PROVIDERS[bestProvider.provider]?.costPer1kTokens ?? 0);
      totalCost += subtaskCost;
      breakdown.push({
        subtask: labels[i],
        provider: bestProvider.provider,
        estimatedCostUsd: Math.round(subtaskCost * 1_000_000) / 1_000_000,
      });
    }

    // Recommended escrow: 1.5x margin, minimum 0.01
    const recommendedEscrow = Math.max(0.01, Math.ceil(totalCost * 1.5 * 100) / 100);

    return {
      subtaskCount,
      estimatedCostUsd: Math.round(totalCost * 1_000_000) / 1_000_000,
      breakdown,
      recommendedEscrow,
    };
  }

  private scoreProvider(config: ProviderConfig, estimatedTokens: number, maxCostUsd: number): ProviderScore {
    const estimatedCostUsd = (estimatedTokens / 1000) * config.costPer1kTokens;

    // Cost score: higher is better (cheaper). 0 if over budget.
    let costScore: number;
    if (estimatedCostUsd > maxCostUsd && config.costPer1kTokens > 0) {
      costScore = 0;
    } else if (config.costPer1kTokens === 0) {
      costScore = 100;
    } else {
      costScore = Math.max(0, 100 - (estimatedCostUsd / maxCostUsd) * 100);
    }

    // Quality score: direct from config
    const qualityScore = config.qualityRating;

    // Speed score: lower ms is better
    const speedScore = Math.max(0, 100 - (config.avgSpeedMs / 50));

    const totalScore =
      costScore * DECISION_WEIGHTS.cost +
      qualityScore * DECISION_WEIGHTS.quality +
      speedScore * DECISION_WEIGHTS.speed;

    return {
      provider: config.name,
      costScore,
      qualityScore,
      speedScore,
      totalScore,
      estimatedCostUsd,
      estimatedQuality: config.qualityRating,
      estimatedSpeedMs: config.avgSpeedMs,
    };
  }
}
