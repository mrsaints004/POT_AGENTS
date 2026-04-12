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
