# Proof of Thought — Technical Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Agent Core System](#agent-core-system)
4. [Merkle Reasoning Tree](#merkle-reasoning-tree)
5. [On-Chain Settlement](#on-chain-settlement)
6. [x402 Payment Protocol](#x402-payment-protocol)
7. [Agent-to-Agent Commerce](#agent-to-agent-commerce)
8. [Gasless Transactions](#gasless-transactions)
9. [Agent Passport & Identity](#agent-passport--identity)
10. [Compare Mode](#compare-mode)
11. [Cross-Chain (LayerZero)](#cross-chain-layerzero)
12. [API Reference](#api-reference)
13. [Smart Contract Architecture](#smart-contract-architecture)
14. [Database Schema](#database-schema)
15. [WebSocket Events](#websocket-events)
16. [CLI Tool](#cli-tool)
17. [Deployment](#deployment)

---

## Overview

Proof of Thought (PoT) is an autonomous AI freelancer agent that:

1. **Accepts tasks** from users via web dashboard, CLI, or x402 API
2. **Decomposes** complex tasks into 2-4 subtasks autonomously
3. **Scores** 5 AI providers using a weighted algorithm (cost 40%, quality 40%, speed 20%)
4. **Executes** subtasks sequentially with context chaining
5. **Records** every reasoning step as a verifiable Merkle tree on the Kite blockchain
6. **Settles** payments via trustless USDT escrow

The agent operates with minimal human involvement — once a task is submitted, everything from decomposition to on-chain attestation happens autonomously.

---

## Architecture

### System Components

```
┌──────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                                │
│                                                                    │
│  ┌───────────┐   ┌──────────┐   ┌──────────────┐                │
│  │  Next.js  │   │  pot-cli │   │ External AI  │                │
│  │ Dashboard │   │   CLI    │   │   Agents     │                │
│  └─────┬─────┘   └─────┬────┘   └──────┬───────┘                │
│        │ HTTP/WS        │ HTTP          │ x402                    │
└────────┼────────────────┼───────────────┼────────────────────────┘
         │                │               │
         ▼                ▼               ▼
┌──────────────────────────────────────────────────────────────────┐
│                      APPLICATION LAYER                             │
│                                                                    │
│  Express.js Backend + Socket.IO                                    │
│                                                                    │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │                    Route Handlers                          │   │
│  │  /tasks  /attestations  /agent  /x402  /gasless           │   │
│  │  /status  /discovery                                      │   │
│  └───────────────────────────────┬───────────────────────────┘   │
│                                  │                                 │
│  ┌───────────────────────────────▼───────────────────────────┐   │
│  │                    AgentCore                               │   │
│  │  ┌────────────────┐  ┌──────────────┐  ┌──────────────┐  │   │
│  │  │Task Decomposer │  │DecisionEngine│  │Merkle Builder│  │   │
│  │  │(Gemini Flash)  │  │(Scoring Algo)│  │(Sub-attests) │  │   │
│  │  └────────────────┘  └──────────────┘  └──────────────┘  │   │
│  └───────────────────────────────┬───────────────────────────┘   │
│                                  │                                 │
│  ┌───────────────────────────────▼───────────────────────────┐   │
│  │                  AI Provider Layer                         │   │
│  │  Claude Sonnet │ GPT-4o │ Gemini Pro │ Gemini Flash │ DS  │   │
│  └───────────────────────────────┬───────────────────────────┘   │
│                                  │                                 │
│  ┌───────────────────────────────▼───────────────────────────┐   │
│  │                    KiteClient                             │   │
│  │  On-chain attestation │ Escrow │ Service Registry │ Relay │   │
│  └───────────────────────────────┬───────────────────────────┘   │
└──────────────────────────────────┼────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                     BLOCKCHAIN LAYER                               │
│                   Kite AI Testnet (2368)                           │
│                                                                    │
│  ┌─────────────────┐ ┌──────────────┐ ┌───────────────────────┐ │
│  │ProofOfThought   │ │Service       │ │GoKite Account         │ │
│  │Contract         │ │Registry      │ │Factory                │ │
│  │                 │ │              │ │                       │ │
│  │• depositForTask │ │• register    │ │• Agent Passport       │ │
│  │• completeTask   │ │• getService  │ │• isRegistered         │ │
│  │• getAttestation │ │• discovery   │ │                       │ │
│  │• escrow release │ │              │ │                       │ │
│  └─────────────────┘ └──────────────┘ └───────────────────────┘ │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │                  LayerZero (Cross-Chain)                      ││
│  │  Attestation bridging to: Sepolia, Polygon, Arbitrum, Base   ││
│  └──────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User submits task
        │
        ▼
┌─── USDT Escrow Deposit (on-chain) ───┐
│   User approves + deposits USDT       │
│   to ProofOfThought contract          │
└───────────────────┬───────────────────┘
                    │
                    ▼
┌─── Task Decomposition (Gemini Flash) ─┐
│   Complex task → 2-4 subtasks          │
│   Each with title + specific instruction│
└───────────────────┬───────────────────┘
                    │
                    ▼
┌─── Provider Scoring (DecisionEngine) ──┐
│   Score each provider per subtask:     │
│   • Cost weight: 40%                  │
│   • Quality weight: 40%              │
│   • Speed weight: 20%                │
│   Select optimal provider per subtask │
└───────────────────┬───────────────────┘
                    │
                    ▼
┌─── Sequential Execution ───────────────┐
│   For each subtask:                    │
│   1. Execute with selected provider    │
│   2. Compute sub-attestation hash      │
│   3. Pass context to next subtask      │
└───────────────────┬───────────────────┘
                    │
                    ▼
┌─── Merkle Tree Construction ───────────┐
│   Leaf hashes = sub-attestation hashes │
│   Build binary tree upward             │
│   Merkle root = final reasoning proof  │
└───────────────────┬───────────────────┘
                    │
                    ▼
┌─── On-Chain Attestation ───────────────┐
│   completeTask(taskId, type,           │
│     merkleRoot, provider, cost)        │
│   → Attestation stored permanently     │
│   → USDT escrow released to agent      │
└────────────────────────────────────────┘
```

---

## Agent Core System

### Task Decomposition

The agent uses Gemini Flash (fastest/cheapest) for planning:

```typescript
// Prompt structure for decomposition
`You are a task planner. Break the following ${taskType} task into 2-4 sequential subtasks.`
```

Each subtask has:
- **title**: Short description
- **instruction**: Specific prompt for the AI provider

Subtasks are executed **sequentially** with **context chaining** — each subtask receives the previous subtask's output as context, enabling coherent multi-step reasoning.

### Decision Engine

The scoring algorithm evaluates every available provider:

```
Score = (costScore × 0.4) + (qualityScore × 0.4) + (speedScore × 0.2)

Where:
  costScore = 100 - (providerCost / maxBudget × 100)
  qualityScore = provider.qualityRating (pre-configured)
  speedScore = 100 - (providerSpeed / maxSpeed × 100)
```

Provider configurations:

| Provider | Cost/1K tokens | Quality | Avg Speed |
|----------|---------------|---------|-----------|
| Claude Sonnet | $0.003 | 96 | 2500ms |
| GPT-4o | $0.005 | 94 | 2000ms |
| Gemini Pro | $0.005 | 95 | 3000ms |
| Gemini Flash | $0.001 | 85 | 1000ms |
| DeepSeek | $0.0014 | 88 | 1500ms |

### Provider Fallback

If a user's preferred provider is unavailable (API key not configured):
1. Agent detects the unavailability
2. Emits a `provider-fallback` reasoning step
3. Selects the next-best provider by score
4. Notifies the user via WebSocket

---

## Merkle Reasoning Tree

### Why a Merkle Tree?

A single hash over all reasoning steps proves the whole, but can't prove individual parts. With a Merkle tree:

- Each subtask gets its own verifiable hash (leaf node)
- Any individual subtask's execution can be independently verified
- The Merkle root proves the entire reasoning chain is intact
- Verification requires only O(log n) hashes — efficient even for complex tasks

### How It Works

```
Task with 4 subtasks:

        Merkle Root (on-chain)
          /            \
      Hash(AB)       Hash(CD)
       /    \         /    \
  Hash(A)  Hash(B)  Hash(C)  Hash(D)
    │         │        │        │
 Subtask1  Subtask2  Subtask3  Subtask4
```

Each leaf hash is computed from:
```typescript
{
  index: subtaskIndex,
  title: subtask.title,
  provider: selectedProvider,
  input: subtask.instruction (first 200 chars),
  resultHash: SHA256(fullResult),
  tokensUsed: number,
  costUsd: number,
}
```

The Merkle root replaces the simple flat hash in the on-chain attestation, providing a richer proof structure while maintaining the same on-chain footprint (one bytes32).

### Verification

Anyone can verify a specific subtask:
1. Request the attestation's reasoning steps from the API
2. Recompute the leaf hash for the subtask in question
3. Use the sibling hashes from the tree to walk up to the root
4. Compare against the on-chain Merkle root

---

## On-Chain Settlement

### ProofOfThought Smart Contract

The contract handles three operations:

**1. Escrow Deposit**
```solidity
function depositForTask(string calldata _taskId, uint256 _amount) external
```
- User approves USDT spend → calls depositForTask
- USDT transferred from user to contract
- Escrow record created: `{depositor, amount, released: false}`

**2. Task Completion (Agent calls)**
```solidity
function completeTask(
  string calldata _taskId,
  string calldata _taskType,
  bytes32 _reasoningHash,    // Merkle root
  string calldata _providerUsed,
  uint256 _costInMicroUSD
) external returns (uint256)
```
- Creates on-chain attestation with reasoning hash
- Releases escrowed USDT to agent wallet
- Emits `AttestationCreated` event

**3. Attestation Query**
```solidity
function getAttestation(uint256 _id) external view returns (Attestation)
function getAttestationsByAgent(address _agent) external view returns (uint256[])
```

### Transaction Flow

```
User                    Contract              Agent
  │                        │                    │
  │── approve(USDT) ──────▶│                    │
  │── depositForTask() ───▶│                    │
  │                        │ (escrow locked)    │
  │                        │                    │
  │                        │◀── completeTask() ─│
  │                        │ (attestation +     │
  │                        │  payment release)  │
  │                        │────── USDT ───────▶│
```

---

## x402 Payment Protocol

### What is x402?

x402 is an HTTP-native payment protocol where:
- API endpoints return **HTTP 402 (Payment Required)** with structured payment requirements
- Clients pay via a facilitator
- After verification, the request is fulfilled

This enables **machine-to-machine commerce** — AI agents can autonomously discover and pay for services.

### Our Implementation

**Endpoint:** `GET /api/x402/execute?type={taskType}&input={input}`

**Without payment:**
```json
HTTP 402
{
  "accepts": [{
    "scheme": "exact",
    "network": "kite-testnet",
    "maxAmountRequired": "10000",  // micro USDT
    "payTo": "0xAgentAddress",
    "asset": "0x0fF5393387...USDT",
    "maxTimeoutSeconds": 300
  }],
  "facilitatorUrl": "https://facilitator.pieverse.io",
  "error": "Payment required."
}
```

**With payment header:**
```
X-Payment: <payment_token_from_facilitator>
```
→ Payment verified → Task executed → Result returned

### Pricing

| Task Type | Price (USDT) |
|-----------|-------------|
| text-generation | $0.01 |
| translation | $0.008 |
| code-review | $0.015 |
| summarization | $0.008 |
| custom | $0.02 |

---

## Agent-to-Agent Commerce

### Discovery Flow

Our agent can discover other services in the GoKite Service Registry:

```
┌─────────────────┐     query     ┌───────────────────┐
│   Our Agent     │──────────────▶│  Service Registry │
│  (PoT Agent)    │◀──────────────│  (on-chain)       │
└────────┬────────┘   services    └───────────────────┘
         │
         │  x402 call
         ▼
┌─────────────────┐
│  External Agent │  ← pays via x402 facilitator
│  (discovered)   │  ← receives task result
└─────────────────┘
```

### Hiring Flow

1. **Discover**: Query `GET /api/discovery/agents` to find registered services
2. **Evaluate**: Check capabilities, pricing, and public status
3. **Hire**: Call `POST /api/discovery/hire` with the agent's endpoint
4. **Pay**: Agent receives 402, pays via x402 facilitator (automated in production)
5. **Receive**: Get the result and incorporate into our workflow

This creates a **full agent economy**: our agent is both a service provider (via x402) and a service consumer (via discovery + hiring).

---

## Gasless Transactions

### Problem

Users need KITE tokens for gas to interact with the smart contract. This creates friction for new users who only have USDT.

### Solution: EIP-712 Meta-Transactions

Using [ERC-3009 (TransferWithAuthorization)](https://eips.ethereum.org/EIPS/eip-3009):

1. User signs an EIP-712 typed message authorizing a USDT transfer
2. Backend receives the signature
3. Backend calls `transferWithAuthorization()` on-chain, paying gas from its own KITE balance
4. USDT moves from user to contract — user never touches KITE

### EIP-712 Domain

```typescript
{
  name: "Test USDT",
  version: "1",
  chainId: 2368,
  verifyingContract: "0x0fF5393387ad2f9f691FD6Fd28e07E3969e27e63"
}
```

### Type Structure

```typescript
TransferWithAuthorization: [
  { name: "from", type: "address" },
  { name: "to", type: "address" },
  { name: "value", type: "uint256" },
  { name: "validAfter", type: "uint256" },
  { name: "validBefore", type: "uint256" },
  { name: "nonce", type: "bytes32" },
]
```

### Rate Limiting

- Max 10 gasless relays per address per hour
- Prevents abuse of the agent's KITE balance

---

## Agent Passport & Identity

### GoKite Account Factory

The Agent Passport provides verifiable identity:

- **Address**: Agent's on-chain address (derived from PRIVATE_KEY)
- **Registration**: Checked against GoKite Account Factory + Service Registry
- **Trust Score**: Dynamically computed from on-chain attestation count
  - Base score: 50
  - +5 per attestation (capped at 99)
  - Higher scores → more trust → could unlock lower x402 prices

### Capabilities

The agent advertises its capabilities:
- text-generation
- translation
- code-review
- summarization
- multi-provider-comparison
- task-decomposition
- on-chain-attestation

---

## Compare Mode

### How It Works

1. User enables "Compare Mode" when creating a task
2. Agent runs **all available providers in parallel** on the same input
3. Results displayed side-by-side with:
   - Full output text
   - Token count
   - Cost in USD
   - Execution time
4. User picks a winner
5. Winner's result becomes the task output
6. Cost savings calculated: `maxCost - winnerCost`

### Cost Savings Analytics

- Per-task: "You saved $X.XX (Y%) by choosing {provider}"
- Aggregate: Total comparisons, total saved, average savings %
- Dedicated `/comparisons` page with full history table

---

## Cross-Chain (LayerZero)

### Current Integration

- Status display on agent page
- Supported networks listed: Kite, Ethereum Sepolia, Polygon Mumbai, Arbitrum Sepolia, Optimism Sepolia, Base Sepolia
- LayerZero endpoint tracked

### Future: Cross-Chain Attestation Bridging

Attestations recorded on Kite could be bridged to other chains via LayerZero:
- Proves AI reasoning verification on Ethereum mainnet
- Enables multi-chain agent reputation
- Cross-chain USDT settlement

---

## API Reference

### Tasks

#### `GET /api/tasks`
Returns all tasks, ordered by creation date (newest first).

#### `GET /api/tasks/:id`
Returns a single task by ID.

#### `POST /api/tasks`
Create and execute a new task.

**Body (multipart/form-data or JSON):**
```json
{
  "type": "text-generation",
  "input": "Your task description",
  "maxCostUsd": 0.05,
  "escrowTxHash": "0x...",
  "depositorAddress": "0x...",
  "preferredProvider": "claude-sonnet",  // optional
  "compareMode": false  // optional
}
```

#### `POST /api/tasks/:id/retry`
Retry a completed/failed task with an optional different provider.

**Body:**
```json
{ "preferredProvider": "gpt-4o" }
```

#### `POST /api/tasks/:id/pick-winner`
Select a winner from compare mode results.

**Body:**
```json
{ "provider": "claude-sonnet" }
```

#### `GET /api/tasks/stats`
Aggregate statistics.

**Response:**
```json
{
  "totalTasks": 42,
  "totalComparisons": 8,
  "avgCostSavings": 34,
  "totalSaved": 0.012,
  "comparisonsRun": 8
}
```

#### `GET /api/tasks/comparisons/history`
Full comparison history with per-task breakdown.

### Attestations

#### `GET /api/attestations`
All attestations with reasoning steps.

#### `GET /api/attestations/:id`
Single attestation with full details.

### Agent

#### `GET /api/agent/profile`
Agent performance metrics, comparison stats, recent attestations.

#### `GET /api/agent/status`
Agent address, chain info, cross-chain status.

#### `GET /api/agent/passport`
Agent Passport: registration, trust score, capabilities.

### x402

#### `GET /api/x402/execute?type={type}&input={input}`
Payment-gated task execution. Returns 402 without payment header.

#### `GET /api/x402/pricing`
Pricing per task type.

### Gasless

#### `POST /api/gasless/relay`
Relay a signed EIP-712 transfer.

**Body:**
```json
{
  "from": "0x...",
  "to": "0x...",
  "value": "1000000",
  "validAfter": 0,
  "validBefore": 1750000000,
  "nonce": "0x...",
  "signature": "0x..."
}
```

#### `GET /api/gasless/info`
EIP-712 domain, types, and relay config.

### Status

#### `GET /api/status`
Live production metrics (public, no auth).

**Response:**
```json
{
  "status": "operational",
  "agent": { "address": "0x...", "kiteBalance": "1.5", "usdtBalance": "10.0" },
  "uptime": { "ms": 3600000, "display": "1h 0m" },
  "tasks": { "total": 42, "completed": 38, "failed": 2, "processing": 2, "successRate": 90 },
  "settlement": { "totalUsdSettled": 0.15, "onChainAttestations": 35 },
  "lastAttestation": { "timestamp": "...", "txHash": "0x...", "explorerUrl": "..." },
  "chain": { "name": "Kite AI Testnet", "chainId": 2368 }
}
```

### Discovery

#### `GET /api/discovery/agents`
Discover other agents in the GoKite Service Registry.

#### `GET /api/discovery/self`
This agent's discoverable profile.

#### `POST /api/discovery/hire`
Hire an external agent.

**Body:**
```json
{
  "agentEndpoint": "https://other-agent.example.com",
  "taskType": "text-generation",
  "input": "Task to delegate"
}
```

---

## Smart Contract Architecture

### ProofOfThought.sol

**Deployed at:** Configured via `PROOF_OF_THOUGHT_CONTRACT` env var

**Key functions:**

| Function | Purpose |
|----------|---------|
| `depositForTask(taskId, amount)` | Lock USDT escrow before execution |
| `completeTask(taskId, type, hash, provider, cost)` | Record attestation + release payment |
| `getAttestation(id)` | Query attestation data |
| `getAttestationsByAgent(addr)` | Get all attestation IDs for an agent |
| `getEscrow(taskId)` | Check escrow status |

**Events:**
- `AttestationCreated(id, taskId, taskType, reasoningHash, providerUsed, cost, agent, timestamp)`
- `EscrowDeposited(taskId, depositor, amount)`
- `PaymentReleased(taskId, recipient, amount)`

### Contract Addresses (Kite Testnet)

| Contract | Address |
|----------|---------|
| ProofOfThought | `0xfC375dCE59C9Cf97f557607F785781d65877938e` |
| Test USDT | `0x0fF5393387ad2f9f691FD6Fd28e07E3969e27e63` |
| GoKite Account Factory | `0xF0Fc19F0dc393867F19351d25EDfc5E099561cb7` |
| Service Registry | `0xc67a4AbcD8853221F241a041ACb1117b38DA587F` |

---

## Database Schema

### tasks

| Column | Type | Description |
|--------|------|-------------|
| id | text PK | UUID |
| type | text | Task type (text-generation, translation, etc.) |
| input | text | User's input text |
| max_cost_usd | real | Maximum budget |
| status | text | pending → selecting-provider → executing → recording-attestation → completed/failed |
| result | text | Final output |
| selected_provider | text | Provider used |
| attestation_id | text FK | Link to attestation |
| escrow_tx_hash | text | User's escrow deposit tx |
| payment_tx_hash | text | Agent's completion tx |
| payment_status | text | none → escrowed → released |
| compare_mode | boolean | Whether compare mode was used |
| winning_provider | text | Winner in compare mode |
| created_at | timestamp | Creation time |
| completed_at | timestamp | Completion time |

### attestations

| Column | Type | Description |
|--------|------|-------------|
| id | text PK | UUID |
| task_id | text FK | Parent task |
| task_type | text | Task type |
| reasoning_hash | text | Merkle root (0x-prefixed) |
| provider_used | text | Main provider |
| cost_usd | real | Actual cost |
| tx_hash | text | On-chain tx hash |
| block_number | integer | Block number |
| agent_address | text | Agent's address |
| reasoning_steps | jsonb | Full reasoning step array |
| created_at | timestamp | Creation time |

### comparison_results

| Column | Type | Description |
|--------|------|-------------|
| id | text PK | UUID |
| task_id | text FK | Parent task |
| provider | text | Provider name |
| result | text | Provider's output |
| tokens_used | integer | Token count |
| cost_usd | real | Actual cost |
| duration_ms | integer | Execution time |
| status | text | pending → executing → completed/failed |
| error | text | Error message if failed |

---

## WebSocket Events

Connect via Socket.IO to the backend URL.

### Server → Client

| Event | Payload | When |
|-------|---------|------|
| `task:update` | `{ taskId, status, selectedProvider?, providerFallback? }` | Task status changes |
| `attestation:step` | `{ taskId, step: { action, description, data } }` | New reasoning step |
| `attestation:finalized` | `{ taskId, attestationId, txHash }` | Attestation recorded |
| `compare:provider-start` | `{ taskId, provider }` | Compare mode provider started |
| `compare:provider-complete` | `{ taskId, provider, result, tokensUsed, costUsd, durationMs }` | Provider finished |
| `compare:provider-failed` | `{ taskId, provider, error, durationMs }` | Provider errored |

---

## CLI Tool

### Installation

The CLI is part of the monorepo at `packages/cli/`.

```bash
# Run directly
npx pot-cli --help

# Or link globally
cd packages/cli && npm link
```

### Commands

```bash
# Create a task
pot-cli task create --type text-generation --input "..." [--provider claude-sonnet] [--watch]

# Check task status
pot-cli task status <task-id> [--watch]

# List recent tasks
pot-cli task list [--limit 20]

# Run compare mode
pot-cli compare --type code-review --input "..." [--max-cost 0.1]

# Agent info
pot-cli agent status
```

### Configuration

```bash
# Set API URL
pot-cli --api-url https://your-backend.com task list

# Or via environment variable
export POT_API_URL=https://your-backend.com
pot-cli task list
```

### Real-Time Monitoring

The `--watch` flag connects via WebSocket and streams:
- Status changes
- Reasoning steps as they happen
- Provider results in compare mode
- Final attestation tx hash

---

## Deployment

### Backend (Railway / Render / AWS)

Required environment variables:
```env
DATABASE_URL=postgresql://...
PRIVATE_KEY=0x...
PROOF_OF_THOUGHT_CONTRACT=0xfC375dCE59C9Cf97f557607F785781d65877938e
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_AI_API_KEY=AI...
DEEPSEEK_API_KEY=sk-...
PORT=3002
FRONTEND_URL=https://your-frontend.vercel.app
```

Build and start:
```bash
cd apps/backend
npm run build
npm start
```

### Frontend (Vercel)

Environment variables:
```env
NEXT_PUBLIC_API_URL=https://your-backend.com
NEXT_PUBLIC_PROOF_OF_THOUGHT_CONTRACT=0xfC375dCE59C9Cf97f557607F785781d65877938e
```

Deploy:
```bash
cd apps/frontend
vercel deploy --prod
```

### Database (Neon)

1. Create a Neon project
2. Copy the connection string to `DATABASE_URL`
3. Push schema: `cd apps/backend && npx drizzle-kit push`

### Verification

After deployment, verify:
1. `GET /api/health` returns `{ status: "ok" }`
2. `GET /api/status` shows operational status with wallet balances
3. Frontend loads and connects to backend
4. Create a test task and verify attestation appears on KiteScan

---

## Security Considerations

- **Private key**: Never exposed to frontend. Only backend uses it for on-chain operations.
- **Rate limiting**: Gasless relay limited to 10/hour/address to prevent gas draining.
- **Escrow validation**: Backend verifies escrow tx hash before executing tasks.
- **Input sanitization**: All user inputs are treated as strings, never executed.
- **CORS**: Backend only accepts requests from configured frontend origins.
- **x402 verification**: Payment headers verified against facilitator before execution.
