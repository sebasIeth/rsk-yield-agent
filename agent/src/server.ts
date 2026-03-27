import express from "express";
import cors from "cors";
import { ethers } from "ethers";
import { fetchAllAPYs } from "./fetcher";
import { analyzeAndPropose } from "./ai/engine";
import { AgentContext } from "./ai/prompts";

const app = express();
app.use(cors());
app.use(express.json());

const RPC_URL = process.env.RSK_RPC_URL || "https://public-node.testnet.rsk.co";
const RBTC_PRICE = parseFloat(process.env.RBTC_PRICE_USD || "95000");

// GET /api/apys — Returns current APYs from all protocols
app.get("/api/apys", async (_req, res) => {
  try {
    const apys = await fetchAllAPYs(RPC_URL);
    res.json({ data: apys, cached: false, timestamp: new Date().toISOString() });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Server] /api/apys error: ${errMsg}`);
    res.status(500).json({ error: "Failed to fetch APYs" });
  }
});

// POST /api/analyze — Triggers AI analysis for a user
app.post("/api/analyze", async (req, res) => {
  try {
    const { userAddress, riskProfile, capitalRbtc, currentAllocation } = req.body;

    if (!userAddress) {
      res.status(400).json({ error: "userAddress required" });
      return;
    }

    const apys = await fetchAllAPYs(RPC_URL);

    const context: AgentContext = {
      user_profile: {
        address: userAddress,
        risk: riskProfile || "balanced",
        capital_rbtc: capitalRbtc || 0,
      },
      current_allocation: currentAllocation || [],
      live_apys: apys,
      gas_cost_estimate_rbtc: 0.000018,
      rbtc_price_usd: RBTC_PRICE,
    };

    const proposal = await analyzeAndPropose(context);
    res.json({ strategy: proposal, apys });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Server] /api/analyze error: ${errMsg}`);
    res.status(500).json({ error: "Analysis failed" });
  }
});

// POST /api/execute — Execute a rebalance on-chain via keeper wallet
app.post("/api/execute", async (req, res) => {
  try {
    const { userAddress, allocations } = req.body;

    if (!userAddress || !allocations || !Array.isArray(allocations)) {
      res.status(400).json({ error: "userAddress and allocations required" });
      return;
    }

    const vaultAddress = process.env.VAULT_ADDRESS;
    const routerAddress = process.env.ROUTER_ADDRESS;
    const agentKey = process.env.AGENT_PRIVATE_KEY;

    if (!vaultAddress || !routerAddress || !agentKey) {
      res.status(500).json({ error: "Agent not configured for on-chain execution" });
      return;
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const keeper = new ethers.Wallet(agentKey, provider);

    const routerAbi = [
      "function rebalance(address user, string[] calldata protocolNames, uint256[] calldata basisPoints, address[] calldata assets) external",
    ];
    const router = new ethers.Contract(routerAddress, routerAbi, keeper);

    const protocolNames = allocations.map((a: { protocol: string }) => a.protocol);
    const basisPoints = allocations.map((a: { percent: number }) => BigInt(Math.round(a.percent * 100)));
    const assets = allocations.map(() => ethers.ZeroAddress);

    console.log(`[${new Date().toISOString()}] [Execute] Rebalancing for ${userAddress}: ${protocolNames.join(", ")}`);

    const tx = await router.rebalance(userAddress, protocolNames, basisPoints, assets, {
      gasPrice: 60000000n,
    });

    console.log(`[${new Date().toISOString()}] [Execute] TX submitted: ${tx.hash}`);

    const receipt = await tx.wait();

    if (!receipt || receipt.status !== 1) {
      throw new Error("Transaction reverted");
    }

    console.log(`[${new Date().toISOString()}] [Execute] TX confirmed in block ${receipt.blockNumber}`);

    res.json({
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Server] /api/execute error: ${errMsg}`);
    res.status(500).json({ error: `Execution failed: ${errMsg}` });
  }
});

// GET /api/health — Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

export function startServer(port: number = 3001): void {
  app.listen(port, () => {
    console.log(`[Server] Agent API running on http://localhost:${port}`);
  });
}

export { app };
