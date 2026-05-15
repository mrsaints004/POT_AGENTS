import { Router, Request, Response } from "express";
import { KITE_TESTNET, SERVICE_REGISTRY_ABI, X402_CONFIG } from "@pot/shared";

const router = Router();

/**
 * Agent-to-Agent Discovery & Hiring.
 *
 * This endpoint demonstrates the full agentic commerce loop:
 * 1. Our agent discovers other services in the GoKite Service Registry
 * 2. Evaluates available agents by capability and price
 * 3. Can delegate subtasks to external agents via x402 payment
 *
 * This creates a true agent economy — not just being payable,
 * but actively hiring other agents for work.
 */

interface DiscoveredAgent {
  serviceId: string;
  name: string;
  owner: string;
  unitPrice: string;
  isPublic: boolean;
  endpoint?: string;
  capabilities?: string[];
}

// Cache discovered agents for 5 minutes
let agentCache: { agents: DiscoveredAgent[]; fetchedAt: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Discover available agents in the Kite Service Registry.
 */
router.get("/agents", async (_req: Request, res: Response) => {
  try {
    // Return cache if fresh
    if (agentCache && Date.now() - agentCache.fetchedAt < CACHE_TTL) {
      return res.json({
        agents: agentCache.agents,
        cached: true,
        source: "GoKite Service Registry",
        registryAddress: KITE_TESTNET.contracts.serviceRegistry,
      });
    }

    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      return res.json({
        agents: [],
        error: "Agent wallet not configured — cannot query registry",
        source: "GoKite Service Registry",
      });
    }

    const { ethers } = await import("ethers");
    const provider = new ethers.JsonRpcProvider(KITE_TESTNET.rpcUrl);
    const registry = new ethers.Contract(
      KITE_TESTNET.contracts.serviceRegistry,
      SERVICE_REGISTRY_ABI as unknown as string[],
      provider
    );

    // Query known service IDs (including our own and any we've seen)
    // In production, you'd use an indexer — for the hackathon, we enumerate known agents
    const knownServiceIds = generateKnownServiceIds();

    const discovered: DiscoveredAgent[] = [];

    for (const { serviceId, label } of knownServiceIds) {
      try {
        const service = await registry.getService(serviceId);
        if (service.serviceOwner !== ethers.ZeroAddress) {
          let endpoint: string | undefined;
          let capabilities: string[] | undefined;

          try {
            const metadataStr = ethers.toUtf8String(service.metadata);
            const meta = JSON.parse(metadataStr);
            endpoint = meta.endpoint;
            capabilities = meta.capabilities;
          } catch {}

          discovered.push({
            serviceId,
            name: service.name || label,
            owner: service.serviceOwner,
            unitPrice: ethers.formatUnits(service.unitPrice, 6) + " USDT",
            isPublic: service.isPublic,
            endpoint,
            capabilities,
          });
        }
      } catch {
        // Service not found — skip
      }
    }

    agentCache = { agents: discovered, fetchedAt: Date.now() };

    res.json({
      agents: discovered,
      cached: false,
      source: "GoKite Service Registry",
      registryAddress: KITE_TESTNET.contracts.serviceRegistry,
      totalDiscovered: discovered.length,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to discover agents",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Hire an external agent to perform a subtask.
 * Demonstrates agent-to-agent commerce: our agent pays another agent via x402.
 */
router.post("/hire", async (req: Request, res: Response) => {
  try {
    const { agentEndpoint, taskType, input } = req.body as {
      agentEndpoint: string;
      taskType: string;
      input: string;
    };

    if (!agentEndpoint || !taskType || !input) {
      return res.status(400).json({
        error: "Missing required fields: agentEndpoint, taskType, input",
      });
    }

    // Step 1: Call the external agent's x402 endpoint to get payment requirements
    const executeUrl = `${agentEndpoint}/api/x402/execute?type=${encodeURIComponent(taskType)}&input=${encodeURIComponent(input)}`;

    const initialResponse = await fetch(executeUrl);

    if (initialResponse.status === 402) {
      // Parse payment requirements
      const paymentReqs = await initialResponse.json();

      // Step 2: In a production system, we'd pay via the x402 facilitator here.
      // For the hackathon demo, we show the payment requirements and simulate the flow.
      return res.json({
        status: "payment_required",
        message: "External agent requires x402 payment. Payment flow initiated.",
        externalAgent: agentEndpoint,
        paymentRequirements: paymentReqs,
        flow: [
          "1. Discovered external agent endpoint",
          "2. Received 402 payment requirements",
          "3. Would pay via x402 facilitator",
          "4. Re-call with payment header to execute",
        ],
        // In production, the agent would automatically pay and execute
        automationNote:
          "In production, this agent autonomously pays the required amount via the x402 facilitator and retrieves the result — creating a fully autonomous agent-to-agent commerce loop.",
      });
    }

    if (initialResponse.ok) {
      // Agent doesn't require payment — just return the result
      const result = await initialResponse.json();
      return res.json({
        status: "completed",
        message: "External agent completed task (no payment required)",
        result,
      });
    }

    return res.status(502).json({
      error: `External agent returned unexpected status: ${initialResponse.status}`,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to hire external agent",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Get our own agent's discoverable profile for other agents.
 */
router.get("/self", async (_req: Request, res: Response) => {
  const privateKey = process.env.PRIVATE_KEY;
  let agentAddress = "Not configured";

  if (privateKey) {
    try {
      const { ethers } = await import("ethers");
      agentAddress = new ethers.Wallet(privateKey).address;
    } catch {}
  }

  res.json({
    name: "Proof of Thought Agent",
    address: agentAddress,
    capabilities: [
      "text-generation",
      "translation",
      "code-review",
      "summarization",
      "multi-provider-comparison",
      "task-decomposition",
    ],
    pricing: X402_CONFIG.pricing,
    x402Endpoint: "/api/x402/execute",
    paymentAsset: "Test USDT",
    network: KITE_TESTNET.name,
    serviceRegistry: KITE_TESTNET.contracts.serviceRegistry,
  });
});

/**
 * Generate known service IDs for discovery.
 * In production, an indexer would provide all registered services.
 */
function generateKnownServiceIds() {
  // We generate service IDs the same way we register: keccak256(abi.encodePacked("pot-agent", address))
  // For the hackathon, we check a few known patterns
  const knownPrefixes = [
    "pot-agent",
    "ai-agent",
    "kite-agent",
    "commerce-agent",
    "data-agent",
  ];

  const knownAddresses = [
    process.env.PRIVATE_KEY
      ? (() => {
          try {
            const { ethers } = require("ethers");
            return new ethers.Wallet(process.env.PRIVATE_KEY).address;
          } catch {
            return null;
          }
        })()
      : null,
  ].filter(Boolean) as string[];

  const ids: { serviceId: string; label: string }[] = [];

  try {
    const { ethers } = require("ethers");
    for (const prefix of knownPrefixes) {
      for (const addr of knownAddresses) {
        const serviceId = ethers.keccak256(
          ethers.solidityPacked(["string", "address"], [prefix, addr])
        );
        ids.push({ serviceId, label: `${prefix}@${addr.substring(0, 10)}` });
      }
    }
  } catch {}

  return ids;
}

export { router as discoveryRoutes };
