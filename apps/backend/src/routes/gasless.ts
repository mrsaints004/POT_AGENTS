import { Router, Request, Response } from "express";
import { KiteClient } from "../blockchain/KiteClient";
import { GASLESS_EIP712_DOMAIN, GASLESS_EIP712_TYPES, KITE_TESTNET } from "@pot/shared";
import type { GaslessTransferRequest } from "@pot/shared";

const router = Router();

// Simple rate limiting: track relay count per address
const relayCount = new Map<string, { count: number; resetAt: number }>();
const MAX_RELAYS_PER_HOUR = 10;

function checkRateLimit(address: string): boolean {
  const now = Date.now();
  const entry = relayCount.get(address.toLowerCase());
  if (!entry || now > entry.resetAt) {
    relayCount.set(address.toLowerCase(), { count: 1, resetAt: now + 3600_000 });
    return true;
  }
  if (entry.count >= MAX_RELAYS_PER_HOUR) {
    return false;
  }
  entry.count++;
  return true;
}

/**
 * Gasless relay endpoint.
 * Accepts an EIP-712 signed TransferWithAuthorization and relays it on-chain.
 * The backend pays gas using its own KITE balance.
 */
router.post("/relay", async (req: Request, res: Response) => {
  try {
    const { from, to, value, validAfter, validBefore, nonce, signature } =
      req.body as GaslessTransferRequest;

    // Validate required fields
    if (!from || !to || !value || !nonce || !signature) {
      return res.status(400).json({
        error: "Missing required fields: from, to, value, nonce, signature",
      });
    }

    // Rate limit
    if (!checkRateLimit(from)) {
      return res.status(429).json({
        error: "Rate limit exceeded. Maximum 10 gasless relays per hour per address.",
      });
    }

    // Verify backend has a configured wallet for relaying
    const privateKey = process.env.PRIVATE_KEY;
    const contractAddress = process.env.PROOF_OF_THOUGHT_CONTRACT;
    if (!privateKey || !contractAddress) {
      return res.status(503).json({
        error: "Gasless relay not available. Backend wallet not configured.",
      });
    }

    const kiteClient = new KiteClient(privateKey, contractAddress);

    const txHash = await kiteClient.relayGaslessTransfer({
      from,
      to,
      value,
      validAfter: validAfter ?? 0,
      validBefore: validBefore ?? Math.floor(Date.now() / 1000) + 3600,
      nonce,
      signature,
    });

    return res.json({
      success: true,
      txHash,
      message: "Gasless transfer relayed successfully.",
      explorerUrl: `${KITE_TESTNET.explorerUrl}/tx/${txHash}`,
    });
  } catch (error) {
    console.error("Gasless relay error:", error);
    return res.status(500).json({
      error: "Gasless relay failed",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get gasless relay info
router.get("/info", (_req: Request, res: Response) => {
  res.json({
    available: !!process.env.PRIVATE_KEY,
    maxRelaysPerHour: MAX_RELAYS_PER_HOUR,
    eip712Domain: GASLESS_EIP712_DOMAIN,
    eip712Types: GASLESS_EIP712_TYPES,
    usdtContract: KITE_TESTNET.contracts.testUSDT,
    description:
      "Sign an EIP-712 TransferWithAuthorization message and submit it here. The backend relays it on-chain, paying gas on your behalf.",
  });
});

export { router as gaslessRoutes };
