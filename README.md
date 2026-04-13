# Proof of Thought (PoT) — Autonomous AI Freelancer Agent

> On-chain verifiable AI task execution with multi-provider orchestration, escrow payments, and reasoning attestations on Kite blockchain.

**Built for the [Kite AI Global Hackathon](https://www.gokite.ai/) — Agentic Commerce Track**

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         User / CLI Client                          │
│                  (Web Dashboard / pot-cli / Agent)                  │
└──────────────┬──────────────────────────────────┬───────────────────┘
               │  REST + WebSocket                │  x402 Payment
               ▼                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        Backend (Express + Socket.IO)                 │
│  ┌────────────┐  ┌──────────────┐  ┌───────────┐  ┌─────────────┐  │
│  │ AgentCore  │  │DecisionEngine│  │ x402 Gate │  │Gasless Relay│  │
│  │ (orchestr.)│  │ (scoring)    │  │ (paywall) │  │ (EIP-712)   │  │
│  └─────┬──────┘  └──────────────┘  └───────────┘  └─────────────┘  │
│        │  Task Decomposition + Provider Selection                   │
│        ▼                                                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ ┌───────────┐  │
│  │  Claude   │ │  GPT-4o  │ │  Gemini  │ │DeepSeek│ │   Mock    │  │
│  │  Sonnet   │ │          │ │ Pro/Flash│ │  Chat  │ │ (testing) │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘ └───────────┘  │
│        │                                                            │
│        ▼  Attestation + Escrow                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                     KiteClient (ethers.js)                   │   │
│  │  PoT Contract │ Test USDT │ Service Registry │ Agent Passport│   │
│  └───────────────────────────┬──────────────────────────────────┘   │
└──────────────────────────────┼──────────────────────────────────────┘
                               │
                               ▼
               ┌───────────────────────────────┐
               │     Kite AI Testnet (2368)    │
               │  ┌─────────────────────────┐  │
               │  │ ProofOfThought Contract │  │
               │  │ • depositForTask()      │  │
               │  │ • completeTask()        │  │
               │  │ • On-chain attestations │  │
               │  └─────────────────────────┘  │
               │  ┌─────────────────────────┐  │
               │  │ GoKite Service Registry │  │
               │  │ • Agent registration    │  │
               │  │ • Service discovery     │  │
               │  └─────────────────────────┘  │
               │  ┌─────────────────────────┐  │
               │  │ LayerZero (Cross-Chain) │  │
               │  │ • Attestation bridging  │  │
               │  └─────────────────────────┘  │
               └───────────────────────────────┘
```

---

## Features

- **Autonomous Task Decomposition** — Breaks complex tasks into 2-4 subtasks, executes sequentially with context chaining
- **Multi-Provider AI Orchestration** — Scores and selects optimal provider (Claude, GPT-4o, Gemini, DeepSeek) based on cost (40%), quality (40%), speed (20%)
- **Compare Mode** — Run all providers in parallel for side-by-side comparison with cost savings analytics
- **On-Chain Reasoning Attestations** — SHA-256 hash of reasoning steps recorded on Kite blockchain for verifiability
- **USDT Escrow Payments** — Users deposit to smart contract; payment released to agent upon completion
- **x402 Payment Protocol** — HTTP 402-based machine-to-machine payments for agent-as-a-service endpoints
- **Gasless Transactions** — EIP-712 meta-transactions so users don't need KITE for gas
- **Agent Passport** — Verifiable agent identity via GoKite Account Factory
- **CLI Tool** — Full-featured CLI (`pot-cli`) for headless task submission and monitoring
- **Cross-Chain Awareness** — LayerZero integration for cross-chain attestation bridging
- **File Upload** — Process PDF, DOCX, CSV, TXT documents with AI
- **Real-Time Updates** — WebSocket-based live reasoning timeline and task progress

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, TailwindCSS, wagmi v3, viem |
| Backend | Express.js, Socket.IO, TypeScript |
| Database | PostgreSQL (Neon) via Drizzle ORM |
| Blockchain | Kite AI Testnet (Chain ID 2368), ethers.js v6 |
| AI Providers | Claude Sonnet, GPT-4o, Gemini Pro/Flash, DeepSeek |
| Smart Contracts | Solidity 0.8.20 (Hardhat), USDT Escrow + Attestation |
| CLI | Commander.js, chalk, ora, socket.io-client |
| Payments | x402 protocol (@coinbase/x402), ERC-20 escrow |
| Monorepo | npm workspaces, Turborepo |

---

## Screenshots

| Dashboard | Compare Mode | Agent Passport |
|-----------|-------------|----------------|
| ![Dashboard](./docs/screenshots/dashboard.png) | ![Compare](./docs/screenshots/compare.png) | ![Agent](./docs/screenshots/agent.png) |

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- PostgreSQL database (or [Neon](https://neon.tech) serverless)
- MetaMask or compatible wallet
- API keys for at least one AI provider

### Environment Variables

Create `.env` files in the backend and frontend:

**`apps/backend/.env`**
```env
# Database
DATABASE_URL=postgresql://...

# Blockchain
PRIVATE_KEY=0x...                          # Agent wallet private key
PROOF_OF_THOUGHT_CONTRACT=0x...            # Deployed PoT contract address

# AI Providers (at least one required)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_AI_API_KEY=AI...
DEEPSEEK_API_KEY=sk-...

# Optional
PORT=3002
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:3002
```

**`apps/frontend/.env.local`**
```env
NEXT_PUBLIC_API_URL=http://localhost:3002
NEXT_PUBLIC_PROOF_OF_THOUGHT_CONTRACT=0x...
```

### Install & Run

```bash
# Install all dependencies
npm install

# Push database schema
cd apps/backend && npx drizzle-kit push && cd ../..

# Start development (frontend + backend)
npm run dev
```

Frontend runs on `http://localhost:3000`, backend on `http://localhost:3002`.

### CLI Tool

```bash
# Run CLI commands
npx pot-cli task create --type text-generation --input "Explain quantum computing"
npx pot-cli task list
npx pot-cli task status <task-id>
npx pot-cli compare --type summarization --input "Your text here..."
npx pot-cli agent status
```

---

## Smart Contracts

| Contract | Address | Description |
|----------|---------|-------------|
| ProofOfThought | Configured via env | Escrow deposits, task completion, on-chain attestations |
| Test USDT | `0x0fF5393387ad2f9f691FD6Fd28e07E3969e27e63` | ERC-20 test token for payments |
| GoKite Account Factory | `0xF0Fc19F0dc393867F19351d25EDfc5E099561cb7` | Agent Passport identity |
| Service Registry | `0xc67a4AbcD8853221F241a041ACb1117b38DA587F` | Agent service discovery |

All contracts deployed on **Kite AI Testnet** (Chain ID: 2368).

- Explorer: [testnet.kitescan.ai](https://testnet.kitescan.ai)
- Faucet: [faucet.gokite.ai](https://faucet.gokite.ai)

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/tasks` | List all tasks |
| `GET` | `/api/tasks/:id` | Get task details |
| `POST` | `/api/tasks` | Create task (requires escrow) |
| `POST` | `/api/tasks/estimate` | Get cost estimate |
| `POST` | `/api/tasks/:id/retry` | Retry with different provider |
| `GET` | `/api/tasks/:id/comparisons` | Get comparison results |
| `POST` | `/api/tasks/:id/pick-winner` | Select comparison winner |
| `GET` | `/api/tasks/stats` | Aggregate task statistics |
| `GET` | `/api/tasks/comparisons/history` | Comparison history |
| `GET` | `/api/attestations` | List all attestations |
| `GET` | `/api/attestations/:id` | Get attestation details |
| `GET` | `/api/agent/profile` | Agent stats and attestations |
| `GET` | `/api/agent/status` | Agent address, chain, passport |
| `GET` | `/api/agent/passport` | Agent Passport details |
| `GET` | `/api/x402/execute` | x402-protected AI task execution |
| `POST` | `/api/gasless/relay` | Relay gasless meta-transaction |

---

## Project Structure

```
proof-of-thought/
├── apps/
│   ├── backend/           # Express API + Socket.IO
│   │   └── src/
│   │       ├── agent/     # AgentCore, DecisionEngine, AI Providers
│   │       ├── blockchain/# KiteClient (ethers.js)
│   │       ├── routes/    # REST API routes (tasks, agent, x402, gasless)
│   │       └── services/  # AttestationService
│   └── frontend/          # Next.js 14 dashboard
│       └── src/
│           ├── app/       # Pages (dashboard, tasks, agent, comparisons)
│           ├── components/# TaskForm, ReasoningViewer, etc.
│           └── lib/       # API client, wagmi config
├── packages/
│   ├── shared/            # Types, constants, ABIs
│   ├── contracts/         # Solidity smart contracts (Hardhat)
│   └── cli/               # CLI tool (pot-cli)
└── turbo.json             # Turborepo config
```

---

## WebSocket Events

Real-time task updates via Socket.IO:

| Event | Description |
|-------|-------------|
| `task:update` | Task status changed |
| `attestation:step` | New reasoning step emitted |
| `attestation:finalized` | Attestation recorded on-chain |
| `compare:provider-start` | Provider started in compare mode |
| `compare:provider-complete` | Provider finished with results |
| `compare:provider-failed` | Provider error in compare mode |

---

## License

MIT
