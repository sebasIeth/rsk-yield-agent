import * as dotenv from "dotenv";
dotenv.config();

// Validate environment variables
if (!process.env.ANTHROPIC_API_KEY) {
  console.warn("WARN: ANTHROPIC_API_KEY is not set — AI analysis will return mock strategies.");
}

if (!process.env.VAULT_ADDRESS) {
  console.warn("WARN: VAULT_ADDRESS is not set — on-chain operations will be skipped.");
}

if (!process.env.ROUTER_ADDRESS) {
  console.warn("WARN: ROUTER_ADDRESS is not set — on-chain operations will be skipped.");
}

import { startScheduler } from "./scheduler";
import { startServer } from "./server";

console.log("=".repeat(60));
console.log("  RSK Yield Agent — AI-Powered DeFi Optimizer");
console.log("  Network: Rootstock (Bitcoin Layer 2)");
console.log("=".repeat(60));
console.log(`  RPC: ${process.env.RSK_RPC_URL || "https://public-node.testnet.rsk.co"}`);
console.log(`  Vault: ${process.env.VAULT_ADDRESS || "(not configured)"}`);
console.log(`  Router: ${process.env.ROUTER_ADDRESS || "(not configured)"}`);
console.log(`  RBTC Price: $${process.env.RBTC_PRICE_USD || "95000"}`);
console.log("=".repeat(60));

startServer(parseInt(process.env.AGENT_PORT || "3001"));
startScheduler();
