import { Router, Request, Response } from "express";
import { X402_CONFIG, KITE_TESTNET } from "@pot/shared";
import { AgentCore } from "../agent/AgentCore";
import type { TaskType } from "@pot/shared";

const router = Router();

/**
 * x402 Payment Protocol - Protected AI task execution endpoint.
 *
 * When called without payment, returns HTTP 402 with payment requirements.
 * External agents can pay via the x402 facilitator to use this agent as a service.
 */
router.get("/execute", async (req: Request, res: Response) => {
  const taskType = (req.query.type as TaskType) || "text-generation";
  const input = req.query.input as string;

  // Check for x402 payment header
  const paymentHeader = req.headers["x-payment"] || req.headers["x-402-payment"];

  if (!paymentHeader) {
    // Return 402 with payment requirements
    const price = X402_CONFIG.pricing[taskType] ?? X402_CONFIG.pricing["custom"];
    const agentAddress = process.env.PRIVATE_KEY
      ? new (await import("ethers")).Wallet(process.env.PRIVATE_KEY).address
      : "0x0000000000000000000000000000000000000000";

    return res.status(402).json({
      accepts: [
        {
          scheme: "exact",
          network: X402_CONFIG.network,
          maxAmountRequired: String(Math.round(price * 1_000_000)), // micro USDT
          resource: `/api/x402/execute?type=${taskType}`,
          description: `AI ${taskType} task execution via Proof of Thought agent`,
          mimeType: "application/json",
          payTo: agentAddress,
          maxTimeoutSeconds: 300,
          asset: X402_CONFIG.asset,
          extra: {
            name: "Proof of Thought Agent",
            version: "1.0.0",
          },
        },
      ],
      facilitatorUrl: X402_CONFIG.facilitatorUrl,
      error: "Payment required. Use x402 protocol to pay for this AI service.",
    });
  }

  // Payment header present — verify with facilitator
  try {
    const facilitatorResponse = await fetch(`${X402_CONFIG.facilitatorUrl}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payment: paymentHeader,
        resource: `/api/x402/execute?type=${taskType}`,
      }),
    });

    if (!facilitatorResponse.ok) {
      return res.status(402).json({
        error: "Payment verification failed",
        details: "The x402 payment could not be verified by the facilitator.",
      });
    }

    // Payment verified — execute the task
    if (!input) {
      return res.status(400).json({ error: "Missing required query parameter: input" });
    }

    const io = req.app.get("io");
    const agent = new AgentCore(io);

    const taskId = await agent.executeTask({
      type: taskType,
      input,
      maxCostUsd: X402_CONFIG.pricing[taskType] ?? 0.02,
    });

    if (!taskId) {
      return res.status(500).json({ error: "Task execution failed" });
    }

    return res.json({
      success: true,
      taskId,
      message: "Task created and executing. Poll /api/tasks/:id for results.",
      statusUrl: `/api/tasks/${taskId}`,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Payment verification error",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get x402 pricing info
router.get("/pricing", (_req: Request, res: Response) => {
  res.json({
    protocol: "x402",
    facilitatorUrl: X402_CONFIG.facilitatorUrl,
    network: X402_CONFIG.network,
    asset: X402_CONFIG.asset,
    assetName: "Test USDT",
    assetDecimals: 6,
    pricing: Object.entries(X402_CONFIG.pricing).map(([taskType, priceUsd]) => ({
      taskType,
      priceUsd,
      priceMicroUsdt: Math.round(priceUsd * 1_000_000),
    })),
  });
});

export { router as x402Routes };
