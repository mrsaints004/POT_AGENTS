import { Router } from "express";
import { eq, desc, sql, count, sum, isNotNull } from "drizzle-orm";
import { db } from "../db";
import { tasks, attestations } from "../schema";
import { KITE_TESTNET } from "@pot/shared";

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
      recentAttestations,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch agent profile" });
  }
});

router.get("/status", async (_req, res) => {
  try {
    const agentAddress = process.env.PRIVATE_KEY
      ? "configured"
      : null;
    const contractAddress = process.env.PROOF_OF_THOUGHT_CONTRACT ?? null;

    // Get actual agent address from latest attestation
    const latestAttestation = await db
      .select({ agentAddress: attestations.agentAddress })
      .from(attestations)
      .limit(1);

    res.json({
      agentAddress: latestAttestation[0]?.agentAddress ?? "Not yet active",
      contractAddress,
      chain: {
        name: KITE_TESTNET.name,
        chainId: KITE_TESTNET.chainId,
        explorerUrl: KITE_TESTNET.explorerUrl,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch agent status" });
  }
});

export { router as agentRoutes };
