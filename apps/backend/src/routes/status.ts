import { Router } from "express";
import { count, eq, desc, sql, isNotNull, sum } from "drizzle-orm";
import { db } from "../db";
import { tasks, attestations } from "../schema";
import { KITE_TESTNET } from "@pot/shared";

const router = Router();

const SERVER_START_TIME = Date.now();

/**
 * Public status page endpoint.
 * Shows live production metrics — judges can verify the agent is running.
 */
router.get("/", async (_req, res) => {
  try {
    // Uptime
    const uptimeMs = Date.now() - SERVER_START_TIME;
    const uptimeHours = Math.floor(uptimeMs / 3_600_000);
    const uptimeMinutes = Math.floor((uptimeMs % 3_600_000) / 60_000);

    // Task stats
    const taskStats = await db
      .select({
        total: count(),
        completed: count(sql`CASE WHEN ${tasks.status} = 'completed' THEN 1 END`),
        failed: count(sql`CASE WHEN ${tasks.status} = 'failed' THEN 1 END`),
        processing: count(sql`CASE WHEN ${tasks.status} NOT IN ('completed', 'failed') THEN 1 END`),
      })
      .from(tasks);

    const { total, completed, failed, processing } = taskStats[0] ?? {
      total: 0,
      completed: 0,
      failed: 0,
      processing: 0,
    };

    // Total USDT settled (from attestation costs)
    const earnedResult = await db
      .select({ total: sum(attestations.costUsd) })
      .from(attestations);
    const totalSettledUsd = Number(earnedResult[0]?.total ?? 0);

    // On-chain attestation count
    const onChainResult = await db
      .select({ count: count() })
      .from(attestations)
      .where(isNotNull(attestations.txHash));
    const onChainAttestations = onChainResult[0]?.count ?? 0;

    // Last attestation timestamp
    const lastAttestation = await db
      .select({ createdAt: attestations.createdAt, txHash: attestations.txHash })
      .from(attestations)
      .orderBy(desc(attestations.createdAt))
      .limit(1);

    // Agent address
    let agentAddress = "Not configured";
    const privateKey = process.env.PRIVATE_KEY;
    if (privateKey) {
      try {
        const { ethers } = await import("ethers");
        const wallet = new ethers.Wallet(privateKey);
        agentAddress = wallet.address;
      } catch {}
    }

    // Agent wallet balance (KITE for gas)
    let kiteBalance = "Unknown";
    let usdtBalance = "Unknown";
    if (privateKey) {
      try {
        const { ethers } = await import("ethers");
        const provider = new ethers.JsonRpcProvider(KITE_TESTNET.rpcUrl);
        const wallet = new ethers.Wallet(privateKey, provider);
        const balance = await provider.getBalance(wallet.address);
        kiteBalance = ethers.formatEther(balance);

        const usdt = new ethers.Contract(
          KITE_TESTNET.contracts.testUSDT,
          ["function balanceOf(address) view returns (uint256)"],
          provider
        );
        const usdtBal = await usdt.balanceOf(wallet.address);
        usdtBalance = ethers.formatUnits(usdtBal, 6);
      } catch {}
    }

    res.json({
      status: "operational",
      agent: {
        address: agentAddress,
        kiteBalance,
        usdtBalance,
      },
      uptime: {
        ms: uptimeMs,
        display: `${uptimeHours}h ${uptimeMinutes}m`,
      },
      tasks: {
        total,
        completed,
        failed,
        processing,
        successRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      },
      settlement: {
        totalUsdSettled: Math.round(totalSettledUsd * 1_000_000) / 1_000_000,
        onChainAttestations,
      },
      lastAttestation: lastAttestation[0]
        ? {
            timestamp: lastAttestation[0].createdAt,
            txHash: lastAttestation[0].txHash,
            explorerUrl: lastAttestation[0].txHash
              ? `${KITE_TESTNET.explorerUrl}/tx/${lastAttestation[0].txHash}`
              : null,
          }
        : null,
      chain: {
        name: KITE_TESTNET.name,
        chainId: KITE_TESTNET.chainId,
        rpcUrl: KITE_TESTNET.rpcUrl,
        explorerUrl: KITE_TESTNET.explorerUrl,
      },
      endpoints: {
        health: "/api/health",
        tasks: "/api/tasks",
        attestations: "/api/attestations",
        x402: "/api/x402/execute",
        gasless: "/api/gasless/relay",
        agent: "/api/agent/profile",
      },
    });
  } catch (error) {
    res.status(500).json({ status: "error", error: "Failed to fetch status" });
  }
});

export { router as statusRoutes };
