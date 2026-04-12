# Proof of Thought — Autonomous AI Freelancer Agent

An autonomous AI agent that operates as an on-chain freelancer on the **Kite AI Testnet**. It accepts tasks, autonomously decomposes them into subtasks, selects optimal AI providers, executes work, and records every reasoning step as an on-chain attestation — creating a fully transparent, verifiable proof of thought.

Built for the **Agentic Commerce** track of the Kite AI Global Hackathon 2026.

## How It Works

```
User deposits USDT escrow → Agent decomposes task into subtasks
→ Scores & selects providers per subtask → Executes sequentially
→ Computes reasoning hash → Records attestation on-chain → Releases payment
```

1. **User connects wallet** and submits a task (text generation, translation, code review, or summarization)
2. **Dynamic cost estimation** calculates subtask count and recommended escrow based on complexity
3. **User deposits USDT** into the escrow smart contract via MetaMask
4. **Agent autonomously decomposes** the task into 2–4 subtasks using Gemini Flash
5. **Decision engine scores providers** (Gemini Pro, Gemini Flash, Mock) per subtask using weighted scoring (cost 40%, quality 40%, speed 20%)
6. **Subtasks execute sequentially** with per-step cost tracking and real-time reasoning timeline via WebSocket
7. **Reasoning hash is computed** (SHA-256 of all reasoning steps) and recorded on Kite blockchain
8. **Escrowed USDT is released** to the agent wallet upon task completion

## Architecture

```
proof-of-thought/
├── apps/
│   ├── backend/          # Express + Socket.io API server
│   │   ├── src/
│   │   │   ├── agent/          # AgentCore, DecisionEngine, AI providers
│   │   │   ├── blockchain/     # KiteClient (ethers.js)
│   │   │   ├── routes/         # tasks, attestations, agent profile
│   │   │   └── schema.ts       # Drizzle ORM schema
│   │   └── ...
│   └── frontend/         # Next.js 14 web app
│       └── src/
│           ├── app/            # Pages: dashboard, tasks, attestations, agent
│           ├── components/     # TaskForm, ReasoningViewer, ConnectWallet
│           ├── hooks/          # useTaskStatus (WebSocket)
│           └── lib/            # api client, wagmi config
├── packages/
│   ├── contracts/        # Solidity smart contract (Hardhat)
│   │   └── contracts/
│   │       └── ProofOfThought.sol
│   └── shared/           # Shared types & constants
│       └── src/
│           ├── types.ts        # Task, Attestation, CostEstimate, etc.
│           └── constants.ts    # Kite testnet config, provider configs, ABIs
└── turbo.json
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, Tailwind CSS, wagmi v3, viem |
| Backend | Express, Socket.io, TypeScript, tsx |
| Database | PostgreSQL (Neon serverless), Drizzle ORM |
| AI Providers | Google Gemini 2.0 Pro, Gemini 2.0 Flash |
| Blockchain | Kite AI Testnet (Chain ID: 2368), Solidity 0.8.20, ethers.js v6 |
| Smart Contract | Hardhat |
| Monorepo | Turbo, npm workspaces |

## Prerequisites

- **Node.js** >= 18
- **npm** >= 9
- **MetaMask** browser extension
- **PostgreSQL** database (or [Neon](https://neon.tech) free tier)
- **Google Gemini API key** — [Get one here](https://aistudio.google.com/apikey)
- **Kite Testnet KITE** for gas — [Faucet](https://faucet.gokite.ai)
- **Test USDT** on Kite Testnet for escrow payments

## Setup

### 1. Clone and install

```bash
git clone <repo-url> proof-of-thought
cd proof-of-thought
npm install
```

### 2. Generate an agent wallet

```bash
npx tsx scripts/generate-wallet.ts
```

This prints a new wallet address and private key. Fund it with testnet KITE from the [faucet](https://faucet.gokite.ai).

### 3. Configure environment

Create a `.env` file in the project root:

```env
# Database (Neon PostgreSQL)
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

# Google Gemini API
GEMINI_API_KEY=your_gemini_api_key

# Agent wallet private key (from generate-wallet script)
PRIVATE_KEY=your_wallet_private_key

# Deployed ProofOfThought contract address on Kite Testnet
PROOF_OF_THOUGHT_CONTRACT=0xYourContractAddress

# Backend server
PORT=3002
FRONTEND_URL=http://localhost:3000
```

Create `apps/frontend/.env.local`:

```env
NEXT_PUBLIC_PROOF_OF_THOUGHT_CONTRACT=0xYourContractAddress
NEXT_PUBLIC_API_URL=http://localhost:3002
```

### 4. Push database schema

```bash
cd apps/backend
npx drizzle-kit push
```

### 5. Deploy the smart contract (if not already deployed)

```bash
cd packages/contracts
npx hardhat compile
npx hardhat run scripts/deploy.ts --network kiteTestnet
```

Copy the deployed contract address into both `.env` files.

### 6. Run the app

From the project root:

```bash
npm run dev
```

This starts both backend (port 3002) and frontend (port 3000) via Turbo.

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:3002
- **Health check:** http://localhost:3002/api/health

## Usage

### Creating a Task

1. Open http://localhost:3000 and click **Connect Wallet** (MetaMask)
2. Switch to **Kite AI Testnet** if prompted
3. Navigate to **New Task**
4. Select a task type and enter your input
5. The cost estimate updates automatically as you type — showing subtask breakdown and recommended escrow
6. Click **Approve & Deposit USDT** — MetaMask will prompt twice (approve + deposit)
7. Watch the real-time **Reasoning Timeline** as the agent decomposes and executes subtasks
8. On completion, the attestation is recorded on-chain and payment is released

### Viewing Agent Profile

Navigate to **/agent** to see:
- Tasks completed, success rate, total earned
- On-chain attestation count
- Agent and contract addresses with KiteScan links
- Recent attestation history with transaction links

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/tasks` | List all tasks |
| `GET` | `/api/tasks/:id` | Get task details |
| `POST` | `/api/tasks` | Create task (requires escrow) |
| `POST` | `/api/tasks/estimate` | Get cost estimate for a task |
| `GET` | `/api/attestations` | List all attestations |
| `GET` | `/api/attestations/:id` | Get attestation details |
| `GET` | `/api/agent/profile` | Agent stats and recent attestations |
| `GET` | `/api/agent/status` | Agent address and chain info |

### Example: Cost Estimation

```bash
curl -X POST http://localhost:3002/api/tasks/estimate \
  -H "Content-Type: application/json" \
  -d '{"type": "code-review", "input": "function add(a, b) { return a + b; }"}'
```

Response:

```json
{
  "subtaskCount": 2,
  "estimatedCostUsd": 0.00125,
  "breakdown": [
    { "subtask": "Parse & understand code", "provider": "gemini-flash", "estimatedCostUsd": 0.000625 },
    { "subtask": "Identify issues", "provider": "gemini-flash", "estimatedCostUsd": 0.000625 }
  ],
  "recommendedEscrow": 0.01
}
```

## Smart Contract

**ProofOfThought.sol** — deployed on Kite AI Testnet

Manages the full escrow-to-attestation lifecycle:

| Function | Description |
|----------|-------------|
| `depositForTask(taskId, amount)` | User locks USDT for a task |
| `completeTask(taskId, taskType, reasoningHash, providerUsed, costInMicroUSD)` | Agent records attestation and releases payment |
| `getAttestation(id)` | View attestation (task type, reasoning hash, provider, cost, agent) |
| `getAttestationsByAgent(address)` | Get all attestation IDs for an agent |
| `getAttestationCount()` | Total attestations recorded |
| `getEscrow(taskId)` | Check escrow status (depositor, amount, released) |

**Key addresses (Kite Testnet):**

| Contract | Address |
|----------|---------|
| Test USDT | `0x0fF5393387ad2f9f691FD6Fd28e07E3969e27e63` |
| Service Registry | `0xc67a4AbcD8853221F241a041ACb1117b38DA587F` |
| GoKite Account Factory | `0xF0Fc19F0dc393867F19351d25EDfc5E099561cb7` |

## WebSocket Events

Real-time task updates via Socket.io:

| Event | Payload | Description |
|-------|---------|-------------|
| `task:update` | `{ taskId, status }` | Task status changed |
| `attestation:step` | `{ taskId, step }` | New reasoning step emitted |
| `attestation:finalized` | `{ taskId, attestationId, txHash }` | Attestation recorded on-chain |

## Reasoning Step Types

Each task execution produces a timeline of reasoning steps visible in the UI:

| Step | Description |
|------|-------------|
| `task-received` | Task accepted with type and input |
| `discover-providers` | Available AI providers found |
| `score-providers` | Providers scored by cost, quality, speed |
| `escrow-verified` | User's USDT escrow deposit confirmed |
| `task-decomposed` | Task broken into subtasks with reasoning |
| `subtask-start` | Subtask execution begins |
| `subtask-complete` | Subtask done — provider, tokens, cost tracked |
| `cost-tracking` | Total execution cost summary |
| `compute-hash` | SHA-256 reasoning hash computed |
| `attestation-recorded` | Hash + metadata written to Kite blockchain |
| `payment-released` | Escrowed USDT transferred to agent |
| `task-finalized` | Task complete, attestation stored |

## Project Scripts

```bash
# Development (runs backend + frontend)
npm run dev

# Build all packages
npm run build

# Lint
npm run lint

# Generate a new agent wallet
npx tsx scripts/generate-wallet.ts

# Database operations (from apps/backend/)
npm run db:push        # Push schema to database
npm run db:generate    # Generate migrations

# Smart contract (from packages/contracts/)
npm run build          # Compile contracts
npm run test           # Run contract tests
npm run deploy         # Deploy to Kite Testnet
```

## Kite AI Testnet

| Property | Value |
|----------|-------|
| Chain ID | 2368 |
| RPC URL | https://rpc-testnet.gokite.ai/ |
| Explorer | https://testnet.kitescan.ai |
| Faucet | https://faucet.gokite.ai |

### Adding Kite Testnet to MetaMask

MetaMask will auto-prompt when connecting through the app. To add manually:

1. Open MetaMask > Networks > Add Network
2. Network Name: **Kite AI Testnet**
3. RPC URL: `https://rpc-testnet.gokite.ai/`
4. Chain ID: `2368`
5. Currency Symbol: `KITE`
6. Explorer: `https://testnet.kitescan.ai`

## License

MIT
