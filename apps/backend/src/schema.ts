import type { InferInsertModel } from "drizzle-orm";
import { pgTable, text, timestamp, real, integer, jsonb, boolean } from "drizzle-orm/pg-core";

export const tasks = pgTable("tasks", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  input: text("input").notNull(),
  maxCostUsd: real("max_cost_usd").notNull(),
  status: text("status").notNull().default("pending"),
  result: text("result"),
  selectedProvider: text("selected_provider"),
  attestationId: text("attestation_id"),
  escrowTxHash: text("escrow_tx_hash"),
  paymentTxHash: text("payment_tx_hash"),
  paymentStatus: text("payment_status").notNull().default("none"),
  retryOf: text("retry_of"),
  retryCount: integer("retry_count").default(0),
  fileName: text("file_name"),
  fileContent: text("file_content"),
  compareMode: boolean("compare_mode").default(false),
  winningProvider: text("winning_provider"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const comparisonResults = pgTable("comparison_results", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => tasks.id),
  provider: text("provider").notNull(),
  result: text("result"),
  tokensUsed: integer("tokens_used").default(0),
  costUsd: real("cost_usd").default(0),
  durationMs: integer("duration_ms").default(0),
  status: text("status").notNull().default("pending"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const attestations = pgTable("attestations", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => tasks.id),
  taskType: text("task_type").notNull(),
  reasoningHash: text("reasoning_hash").notNull(),
  providerUsed: text("provider_used").notNull(),
  costUsd: real("cost_usd").notNull(),
  txHash: text("tx_hash"),
  blockNumber: integer("block_number"),
  agentAddress: text("agent_address").notNull(),
  reasoningSteps: jsonb("reasoning_steps").notNull().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type TaskInsert = InferInsertModel<typeof tasks>;
export type TaskUpdate = Partial<TaskInsert>;
export type AttestationInsert = InferInsertModel<typeof attestations>;
export type ComparisonInsert = InferInsertModel<typeof comparisonResults>;
export type ComparisonUpdate = Partial<ComparisonInsert>;
