export type TaskType = "text-generation" | "translation" | "code-review" | "summarization" | "custom";

export type TaskStatus = "pending" | "processing" | "selecting-provider" | "executing" | "recording-attestation" | "completed" | "failed";

export type ProviderName = "gemini-pro" | "gemini-flash" | "claude-sonnet" | "gpt-4o" | "deepseek-chat" | "mock";

export type PaymentStatus = "none" | "escrowed" | "released";

export interface Task {
  id: string;
  type: TaskType;
  input: string;
  maxCostUsd: number;
  status: TaskStatus;
  result?: string;
  selectedProvider?: ProviderName;
  attestationId?: string;
  escrowTxHash?: string;
  paymentTxHash?: string;
  paymentStatus?: PaymentStatus;
  retryOf?: string;
  retryCount?: number;
  fileName?: string;
  createdAt: string;
  completedAt?: string;
}

export interface ProviderScore {
  provider: ProviderName;
  costScore: number;
  qualityScore: number;
  speedScore: number;
  totalScore: number;
  estimatedCostUsd: number;
  estimatedQuality: number;
  estimatedSpeedMs: number;
}

export interface ReasoningStep {
  id: string;
  taskId: string;
  step: number;
  action: string;
  description: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

export interface Attestation {
  id: string;
  taskId: string;
  taskType: TaskType;
  reasoningHash: string;
  providerUsed: ProviderName;
  costUsd: number;
  txHash?: string;
  blockNumber?: number;
  agentAddress: string;
  timestamp: string;
  reasoningSteps: ReasoningStep[];
}

export interface ProviderConfig {
  name: ProviderName;
  model: string;
  costPer1kTokens: number;
  qualityRating: number;
  avgSpeedMs: number;
}

export interface CostEstimate {
  subtaskCount: number;
  estimatedCostUsd: number;
  breakdown: {
    subtask: string;
    provider: ProviderName;
    estimatedCostUsd: number;
  }[];
  recommendedEscrow: number;
}

export interface TaskCreateInput {
  type: TaskType;
  input: string;
  maxCostUsd: number;
  status?: TaskStatus; // Added status property
  escrowTxHash?: string;
  depositorAddress?: string;
  taskId?: string;
  preferredProvider?: ProviderName;
  fileName?: string;
  fileContent?: string;
  compareMode?: boolean;
}

export interface ComparisonResult {
  id: string;
  taskId: string;
  provider: ProviderName;
  result?: string;
  tokensUsed: number;
  costUsd: number;
  durationMs: number;
  status: "pending" | "executing" | "completed" | "failed";
  error?: string;
  createdAt: string;
  completedAt?: string;
}

// x402 Payment Protocol
export interface X402PaymentRequirements {
  scheme: "exact";
  network: "kite-testnet";
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
  extra: {
    name: string;
    version: string;
  };
}

export interface X402Config {
  facilitatorUrl: string;
  paymentRecipient: string;
  pricing: Record<TaskType, number>;
}

// Gasless Transactions (EIP-712 / ERC-3009)
export interface GaslessTransferRequest {
  from: string;
  to: string;
  value: string;
  validAfter: number;
  validBefore: number;
  nonce: string;
  signature: string;
}

export interface EIP712Domain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: string;
}

// Agent Passport
export interface AgentPassport {
  agentAddress: string;
  isRegistered: boolean;
  capabilities: string[];
  trustScore: number;
  registeredAt?: string;
  serviceId?: string;
}

// Cost Savings Analytics
export interface TaskStats {
  totalTasks: number;
  totalComparisons: number;
  avgCostSavings: number;
  totalSaved: number;
  comparisonsRun: number;
}

export interface ComparisonHistory {
  taskId: string;
  taskType: TaskType;
  input: string;
  createdAt: string;
  providersRun: number;
  winner?: ProviderName;
  winnerCost: number;
  avgCost: number;
  maxCost: number;
  savings: number;
  comparisons: ComparisonResult[];
}

// Cross-Chain
export interface CrossChainInfo {
  kiteTestnet: {
    connected: boolean;
    chainId: number;
  };
  layerZero: {
    available: boolean;
    endpoint: string;
    supportedNetworks: string[];
  };
}
