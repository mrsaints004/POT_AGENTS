import { ProviderConfig } from "./types";

export const KITE_TESTNET = {
  chainId: 2368,
  name: "Kite AI Testnet",
  rpcUrl: "https://rpc-testnet.gokite.ai/",
  explorerUrl: "https://testnet.kitescan.ai",
  faucetUrl: "https://faucet.gokite.ai",
  contracts: {
    testUSDT: "0x0fF5393387ad2f9f691FD6Fd28e07E3969e27e63",
    gokiteAccountFactory: "0xF0Fc19F0dc393867F19351d25EDfc5E099561cb7",
    serviceRegistry: "0xc67a4AbcD8853221F241a041ACb1117b38DA587F",
    /** ProofOfThought escrow / attestation contract (same default as backend `PROOF_OF_THOUGHT_CONTRACT` docs). Override per deployment via env. */
    proofOfThought: "0xfC375dCE59C9Cf97f557607F785781d65877938e",
  },
} as const;

export const PROVIDERS: Record<string, ProviderConfig> = {
  "gemini-pro": {
    name: "gemini-pro",
    model: "gemini-2.0-pro",
    costPer1kTokens: 0.005,
    qualityRating: 95,
    avgSpeedMs: 3000,
  },
  "gemini-flash": {
    name: "gemini-flash",
    model: "gemini-2.0-flash",
    costPer1kTokens: 0.001,
    qualityRating: 85,
    avgSpeedMs: 1000,
  },
  "claude-sonnet": {
    name: "claude-sonnet",
    model: "claude-sonnet-4-20250514",
    costPer1kTokens: 0.003,
    qualityRating: 96,
    avgSpeedMs: 2500,
  },
  "gpt-4o": {
    name: "gpt-4o",
    model: "gpt-4o",
    costPer1kTokens: 0.005,
    qualityRating: 94,
    avgSpeedMs: 2000,
  },
  "deepseek-chat": {
    name: "deepseek-chat",
    model: "deepseek-chat",
    costPer1kTokens: 0.0014,
    qualityRating: 88,
    avgSpeedMs: 1500,
  },
  mock: {
    name: "mock",
    model: "mock-v1",
    costPer1kTokens: 0,
    qualityRating: 50,
    avgSpeedMs: 100,
  },
};

export const DECISION_WEIGHTS = {
  cost: 0.4,
  quality: 0.4,
  speed: 0.2,
} as const;

export const SERVICE_REGISTRY_ABI = [
  "function registerService(bytes32 serviceId, tuple(address serviceOwner, uint8 priceModel, uint256 unitPrice, bytes32 provider, bytes metadata, string name, bool isPublic) service) external",
  "function getService(bytes32 serviceId) external view returns (tuple(address serviceOwner, uint8 priceModel, uint256 unitPrice, bytes32 provider, bytes metadata, string name, bool isPublic))",
  "function hasRole(bytes32 role, address account) external view returns (bool)",
  "function SERVICE_REGISTRY_ADMIN_ROLE() external view returns (bytes32)",
  "function version() external view returns (string)",
] as const;

export const TASK_TYPE_LABELS: Record<string, string> = {
  "text-generation": "Text Generation",
  translation: "Translation",
  "code-review": "Code Review",
  summarization: "Summarization",
  custom: "Custom Task",
};

// x402 Payment Protocol Configuration
export const X402_CONFIG = {
  facilitatorUrl: "https://facilitator.pieverse.io",
  pricing: {
    "text-generation": 0.01,
    translation: 0.008,
    "code-review": 0.015,
    summarization: 0.008,
    custom: 0.02,
  },
  asset: KITE_TESTNET.contracts.testUSDT,
  network: "kite-testnet",
} as const;

// EIP-712 Domain for Gasless Transfers (TransferWithAuthorization - ERC-3009)
export const GASLESS_EIP712_DOMAIN = {
  name: "Test USDT",
  version: "1",
  chainId: KITE_TESTNET.chainId,
  verifyingContract: KITE_TESTNET.contracts.testUSDT,
} as const;

export const GASLESS_EIP712_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

// GoKite Account Factory ABI (Agent Passport)
export const GOKITE_ACCOUNT_FACTORY_ABI = [
  "function getAccount(address owner) external view returns (address)",
  "function isRegistered(address account) external view returns (bool)",
] as const;

// Cross-Chain Configuration
export const CROSS_CHAIN_CONFIG = {
  layerZero: {
    available: true,
    endpoint: "https://testnet.layerzero-scan.com",
    supportedNetworks: [
      "Kite AI Testnet",
      "Ethereum Sepolia",
      "Polygon Mumbai",
      "Arbitrum Sepolia",
      "Optimism Sepolia",
      "Base Sepolia",
    ],
  },
} as const;
