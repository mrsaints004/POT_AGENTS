import { Router } from "express";
import { eq, desc, sql, count, sum, isNotNull, avg } from "drizzle-orm";
import { db } from "../db";
import { tasks, attestations, comparisonResults } from "../schema";
import { KITE_TESTNET, CROSS_CHAIN_CONFIG } from "@pot/shared";
import { KiteClient } from "../blockchain/KiteClient";

const router = Router();

router.get("/profile", async (_req, res) => {
  try {
    // Tasks completed & total
    const taskStats = await db
      .select({
        total: count(),
        completed: count(sql`CASE WHEN ${tasks.status} = 'completed' THEN 1 END`),
        failed: count(sql`CASE WHEN ${tasks.status} = 'failed' THEN 1 END`),
      })
      .from(tasks);

    const { total, completed, failed } = taskStats[0] ?? { total: 0, completed: 0, failed: 0 };
    const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Total earned
    const earnedResult = await db
      .select({ totalEarned: sum(attestations.costUsd) })
      .from(attestations);
    const totalEarned = Number(earnedResult[0]?.totalEarned ?? 0);

    // On-chain attestation count
    const onChainResult = await db
      .select({ count: count() })
      .from(attestations)
      .where(isNotNull(attestations.txHash));
    const onChainCount = onChainResult[0]?.count ?? 0;

    // Comparison stats
    const compareTaskStats = await db
      .select({ count: count() })
      .from(tasks)
      .where(eq(tasks.compareMode, true));
    const comparisonsRun = compareTaskStats[0]?.count ?? 0;

    // Calculate cost savings from comparisons
    let totalSaved = 0;
    let avgCostSavings = 0;
    if (comparisonsRun > 0) {
      const compareTasksRows = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(eq(tasks.compareMode, true));

      let savingsCount = 0;
      let savingsSum = 0;

      for (const ct of compareTasksRows) {
        const compRows = await db
          .select()
          .from(comparisonResults)
          .where(eq(comparisonResults.taskId, ct.id));

        const completedComps = compRows.filter((c) => c.status === "completed" && (c.costUsd ?? 0) > 0);
        if (completedComps.length >= 2) {
          const costs = completedComps.map((c) => c.costUsd ?? 0);
          const minCost = Math.min(...costs);
          const maxCost = Math.max(...costs);
          const savings = maxCost - minCost;
          if (savings > 0) {
            totalSaved += savings;
            savingsSum += (savings / maxCost) * 100;
            savingsCount++;
          }
        }
      }

      avgCostSavings = savingsCount > 0 ? Math.round(savingsSum / savingsCount) : 0;
    }

    // Recent attestations
    const recentAttestations = await db
      .select({
        id: attestations.id,
        taskId: attestations.taskId,
        taskType: attestations.taskType,
        providerUsed: attestations.providerUsed,
        costUsd: attestations.costUsd,
        txHash: attestations.txHash,
        createdAt: attestations.createdAt,
      })
      .from(attestations)
      .orderBy(desc(attestations.createdAt))
      .limit(10);

    res.json({
      tasksCompleted: completed,
      tasksFailed: failed,
      tasksTotal: total,
      successRate,
      totalEarned: Math.round(totalEarned * 1_000_000) / 1_000_000,
      onChainAttestations: onChainCount,
      comparisonsRun,
      totalSaved: Math.round(totalSaved * 1_000_000) / 1_000_000,
      avgCostSavings,
      recentAttestations,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch agent profile" });
  }
});

router.get("/status", async (_req, res) => {
  try {
    const privateKey = process.env.PRIVATE_KEY;
    const contractAddress = process.env.PROOF_OF_THOUGHT_CONTRACT ?? null;

    // Get actual agent address from latest attestation
    const latestAttestation = await db
      .select({ agentAddress: attestations.agentAddress })
      .from(attestations)
      .limit(1);

    let agentAddress = latestAttestation[0]?.agentAddress ?? "Not yet active";

    // If we have a private key, derive the address
    if (privateKey) {
      try {
        const { ethers } = await import("ethers");
        const wallet = new ethers.Wallet(privateKey);
        agentAddress = wallet.address;
      } catch {}
    }

    // Cross-chain info
    const crossChain = {
      kiteTestnet: {
        connected: true,
        chainId: KITE_TESTNET.chainId,
      },
      layerZero: {
        available: CROSS_CHAIN_CONFIG.layerZero.available,
        endpoint: CROSS_CHAIN_CONFIG.layerZero.endpoint,
        supportedNetworks: [...CROSS_CHAIN_CONFIG.layerZero.supportedNetworks],
      },
    };

    res.json({
      agentAddress,
      contractAddress,
      chain: {
        name: KITE_TESTNET.name,
        chainId: KITE_TESTNET.chainId,
        explorerUrl: KITE_TESTNET.explorerUrl,
      },
      crossChain,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch agent status" });
  }
});

// Agent Passport endpoint
router.get("/passport", async (_req, res) => {
  try {
    const privateKey = process.env.PRIVATE_KEY;
    const contractAddress = process.env.PROOF_OF_THOUGHT_CONTRACT;

    if (!privateKey || !contractAddress) {
      return res.json({
        agentAddress: "Not configured",
        isRegistered: false,
        capabilities: [],
        trustScore: 0,
      });
    }

    const kiteClient = new KiteClient(privateKey, contractAddress);
    const passport = await kiteClient.getAgentPassportInfo();

    res.json(passport);
  } catch (error) {
    console.error("Passport error:", error);
    res.status(500).json({ error: "Failed to fetch agent passport" });
  }
});

export { router as agentRoutes };
