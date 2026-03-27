# RSK Yield Agent

AI-powered DeFi yield optimization agent for **Rootstock (RSK)**, the Bitcoin Layer 2 EVM-compatible network.

The agent monitors yield opportunities across Rootstock DeFi protocols (Sovryn, Tropykus, MoneyOnChain), uses **Claude AI** to analyze optimal strategies for the user's risk profile, and proposes rebalancing actions that the user approves from their wallet.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (Next.js)                      │
│   Dashboard  │  Strategy View  │  History  │  Wallet (RSK)   │
└──────┬───────────────┬──────────────┬───────────────────────┘
       │               │              │
       ▼               ▼              ▼
┌─────────────────────────────────────────────────────────────┐
│                     API ROUTES (Next.js)                     │
│   /api/apys    │  /api/strategy  │  /api/history             │
└──────┬───────────────┬──────────────┬───────────────────────┘
       │               │              │
       ▼               ▼              ▼
┌─────────────────────────────────────────────────────────────┐
│                     AGENT (Node.js + TS)                     │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────┐     │
│  │ Fetchers │  │  AI Engine   │  │     Executor        │     │
│  │ Sovryn   │  │ Claude API   │  │  Rebalancer         │     │
│  │ Tropykus │  │ (sonnet-4-5) │  │  (prepare + exec)   │     │
│  │ MOC      │  │              │  │                     │     │
│  └──────────┘  └──────────────┘  └────────────────────┘     │
│                     Scheduler (cron 6h)                       │
└──────┬───────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│               ROOTSTOCK BLOCKCHAIN (L2 Bitcoin)              │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────┐     │
│  │  Vault   │  │ YieldRouter  │  │     Adapters        │     │
│  │ (funds)  │──│ (routing)    │──│ Sovryn | Tropykus   │     │
│  │          │  │              │  │ MoneyOnChain         │     │
│  └──────────┘  └──────────────┘  └────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Solidity 0.8.20, Hardhat, OpenZeppelin v5 |
| Network | Rootstock Testnet (chainId 31) / Mainnet (chainId 30) |
| Agent | Node.js, TypeScript, ethers.js v6 |
| AI | Anthropic Claude API (claude-sonnet-4-5) |
| Frontend | Next.js 14 (App Router), Wagmi v2, RainbowKit v2, Viem v2 |
| Database | PostgreSQL + Prisma ORM |
| Styling | TailwindCSS v3 |
| Charts | Recharts |

## Prerequisites

- **Node.js** 20+
- **PostgreSQL** (for production; mock data works without it)
- **MetaMask** or compatible wallet configured for Rootstock
- **tRBTC** for testnet transactions

### Getting tRBTC (Testnet)

Visit the Rootstock faucet to get free testnet RBTC:
https://faucet.rootstock.io

## Quick Start (Demo Mode)

```bash
# Terminal 1: Start agent (serves API + cron scheduler)
cd agent && npm run dev

# Terminal 2: Start frontend
cd frontend && npm run dev

# Open http://localhost:3000
```

No database or blockchain connection required -- everything works with mock data out of the box.

## Setup

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd rsk-yield-agent

# Install all workspace dependencies from root
npm install
```

### 2. Configure Environment Variables

```bash
# Copy example env files
cp contracts/.env.example contracts/.env
cp agent/.env.example agent/.env
cp frontend/.env.example frontend/.env
```

Edit each `.env` file with your values:
- `DEPLOYER_PRIVATE_KEY` — deployer wallet private key (with tRBTC) in `contracts/.env`
- `ANTHROPIC_API_KEY` — your Anthropic API key in `agent/.env`
- `DATABASE_URL` — PostgreSQL connection string (optional, mock data works without it)

### 3. Deploy Smart Contracts

```bash
cd contracts
npx hardhat compile
npx hardhat test  # Run tests first
npx hardhat run scripts/deploy.ts --network rskTestnet
```

The deploy script outputs all contract addresses and saves them to `deployments.json`.
Copy the Vault and Router addresses to the agent and frontend `.env` files.

### 4. Setup Database (Optional)

```bash
cd frontend
npx prisma migrate dev --name init
```

The app works with mock data without a database.

### 5. Start the Agent

```bash
cd agent
npm run dev
```

The agent starts an HTTP server on port 3001 and runs a cron scheduler that analyzes yields every 6 hours. The frontend calls the agent API to fetch APYs, trigger analysis, and retrieve strategies.

### 6. Start the Frontend

```bash
cd frontend
npm run dev
```

Open http://localhost:3000

## Development without Database

Everything works with mock data when `DATABASE_URL` is not set. The agent returns simulated APY data and strategy proposals, and the frontend displays mock history and portfolio data. This is the recommended way to develop and demo the application locally.

## Usage Flow

1. Open http://localhost:3000 and connect your MetaMask wallet (Rootstock Testnet)
2. Deposit tRBTC into the vault via the "Deposit" button
3. The agent automatically analyzes yields (or click "Analyze Now" on the Strategy page)
4. The agent calls Claude AI with live APY data and your risk profile
5. A strategy proposal appears on `/strategy` with the recommended allocation
6. Click "Approve & Execute" to sign and submit the rebalancing transaction
7. View your rebalancing history on `/history`

## Project Structure

```
rsk-yield-agent/
├── contracts/          # Solidity smart contracts + Hardhat
│   ├── contracts/      # Vault, YieldRouter, Adapters
│   ├── scripts/        # Deploy script
│   └── test/           # Contract tests
├── agent/              # AI yield optimization agent
│   └── src/
│       ├── fetcher/    # Protocol APY fetchers
│       ├── ai/         # Claude AI engine + prompts
│       └── executor/   # On-chain rebalancer
├── frontend/           # Next.js web application
│   ├── app/            # Pages + API routes
│   ├── prisma/         # Database schema
│   └── components/     # React components
└── README.md
```

## Supported Protocols

| Protocol | Assets | Risk Level |
|----------|--------|------------|
| Sovryn | RBTC, DOC | Low |
| Tropykus | RBTC, USDRIF | Low |
| MoneyOnChain | DOC, BPRO, MOC | Low-High |

## Useful Links

- [Rootstock Documentation](https://developers.rsk.co/)
- [Rootstock Testnet Explorer](https://explorer.testnet.rsk.co)
- [Rootstock Faucet](https://faucet.rootstock.io)
- [Sovryn Wiki](https://wiki.sovryn.com/)
- [Anthropic Claude API](https://docs.anthropic.com/)

## License

MIT
