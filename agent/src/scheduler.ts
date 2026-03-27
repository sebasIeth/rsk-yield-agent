import * as cron from "node-cron";
import { fetchAllAPYs, ProtocolAPYs } from "./fetcher";
import { analyzeAndPropose } from "./ai/engine";
import { prepareRebalance } from "./executor/rebalancer";
import { AgentContext, StrategyProposal } from "./ai/prompts";

// In production, these would come from the database
const MOCK_USERS = [
  {
    address: "0x0000000000000000000000000000000000000001",
    risk: "balanced" as const,
    capital_rbtc: 0.5,
    current_allocation: [
      { protocol: "sovryn", asset: "RBTC", percent: 60, current_apy: 4.2 },
      { protocol: "tropykus", asset: "RBTC", percent: 40, current_apy: 3.8 },
    ],
  },
];

const RPC_URL = process.env.RSK_RPC_URL || "https://public-node.testnet.rsk.co";
const VAULT_ADDRESS = process.env.VAULT_ADDRESS || "";
const ROUTER_ADDRESS = process.env.ROUTER_ADDRESS || "";
const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY || "";
const RBTC_PRICE = parseFloat(process.env.RBTC_PRICE_USD || "95000");

let isRunning = false;

/**
 * Compare two sets of APYs and return true if any protocol's APY changed
 * by more than the given relative threshold (e.g., 0.20 = 20%).
 */
function hasSignificantChange(
  original: ProtocolAPYs,
  fresh: ProtocolAPYs,
  threshold: number
): boolean {
  const extractApys = (apys: ProtocolAPYs): number[] => [
    apys.sovryn.RBTC.apy,
    apys.sovryn.DOC.apy,
    apys.tropykus.RBTC.apy,
    apys.tropykus.USDRIF.apy,
    apys.moneyonchain.DOC.apy,
    apys.moneyonchain.BPRO.apy,
    apys.moneyonchain.MOC.apy,
  ];

  const origValues = extractApys(original);
  const freshValues = extractApys(fresh);

  for (let i = 0; i < origValues.length; i++) {
    const orig = origValues[i];
    const curr = freshValues[i];
    if (orig === 0 && curr === 0) continue;
    const base = orig === 0 ? curr : orig;
    const relativeChange = Math.abs(curr - orig) / Math.abs(base);
    if (relativeChange > threshold) {
      return true;
    }
  }
  return false;
}

interface RiskConstraints {
  maxSingleProtocol: number;
  maxHighRisk: number;
}

const RISK_CONSTRAINTS: Record<string, RiskConstraints> = {
  conservative: { maxSingleProtocol: 80, maxHighRisk: 0 },
  balanced: { maxSingleProtocol: 80, maxHighRisk: 30 },
  aggressive: { maxSingleProtocol: 80, maxHighRisk: 60 },
};

function validateStrategy(
  proposal: StrategyProposal,
  riskProfile: string
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check no single protocol > 80%
  for (const alloc of proposal.new_allocation) {
    if (alloc.percent > 80) {
      errors.push(`Protocol ${alloc.protocol} has ${alloc.percent}% allocation (max 80%)`);
    }
  }

  // Check allocations sum to 100
  const total = proposal.new_allocation.reduce((sum, a) => sum + a.percent, 0);
  if (Math.abs(total - 100) > 0.01) {
    errors.push(`Allocations sum to ${total}, expected 100`);
  }

  // Check risk profile constraints
  const constraints = RISK_CONSTRAINTS[riskProfile] || RISK_CONSTRAINTS.balanced;
  // We consider any allocation with apy > 20% as high-risk (heuristic)
  const highRiskPercent = proposal.new_allocation
    .filter((a) => a.apy > 20)
    .reduce((sum, a) => sum + a.percent, 0);
  if (highRiskPercent > constraints.maxHighRisk) {
    errors.push(
      `High-risk allocation ${highRiskPercent}% exceeds max ${constraints.maxHighRisk}% for ${riskProfile} profile`
    );
  }

  return { valid: errors.length === 0, errors };
}

export async function runOnce(): Promise<void> {
  if (isRunning) {
    console.log(`[${new Date().toISOString()}] [Scheduler] Cycle already running — skipping`);
    return;
  }

  isRunning = true;

  console.log(`\n${"=".repeat(60)}`);
  console.log(`[${new Date().toISOString()}] [Scheduler] Starting yield analysis cycle`);
  console.log(`${"=".repeat(60)}`);

  try {
    const apys = await fetchAllAPYs(RPC_URL);

    for (const user of MOCK_USERS) {
      console.log(`\n[${new Date().toISOString()}] [Scheduler] Analyzing user: ${user.address}`);

      const context: AgentContext = {
        user_profile: {
          address: user.address,
          risk: user.risk,
          capital_rbtc: user.capital_rbtc,
        },
        current_allocation: user.current_allocation,
        live_apys: apys,
        gas_cost_estimate_rbtc: 0.000018, // ~300k gas * 0.06 gwei
        rbtc_price_usd: RBTC_PRICE,
      };

      const proposal = await analyzeAndPropose(context);

      // Post-AI validation
      if (proposal.should_rebalance) {
        const validation = validateStrategy(proposal, user.risk);
        if (!validation.valid) {
          console.warn(
            `[${new Date().toISOString()}] [Scheduler] Strategy failed validation: ${validation.errors.join("; ")}`
          );
          console.log(`[${new Date().toISOString()}] [Scheduler] Skipping rebalance for ${user.address} due to validation failure`);
          continue;
        }
      }

      if (proposal.should_rebalance) {
        console.log(`[${new Date().toISOString()}] [Scheduler] Rebalance recommended for ${user.address}`);
        console.log(`[${new Date().toISOString()}] [Scheduler] Reason: ${proposal.reason}`);
        console.log(`[${new Date().toISOString()}] [Scheduler] New APY: ${proposal.estimated_apy}% (was ${proposal.current_apy}%)`);

        // Re-fetch APYs before execution to guard against stale data
        const freshApys = await fetchAllAPYs(RPC_URL);
        if (hasSignificantChange(apys, freshApys, 0.20)) {
          console.warn(`[${new Date().toISOString()}] [Scheduler] APYs changed significantly since analysis — skipping rebalance`);
          continue;
        }

        if (VAULT_ADDRESS && ROUTER_ADDRESS && AGENT_PRIVATE_KEY) {
          const result = await prepareRebalance(
            user.address,
            proposal,
            VAULT_ADDRESS,
            ROUTER_ADDRESS,
            RPC_URL,
            AGENT_PRIVATE_KEY
          );
          console.log(`[${new Date().toISOString()}] [Scheduler] Rebalance prepared: ${result.strategyId} (${result.status})`);
        } else {
          console.log(`[${new Date().toISOString()}] [Scheduler] Skipping on-chain preparation (missing contract config)`);
        }
      } else {
        console.log(`[${new Date().toISOString()}] [Scheduler] No rebalance needed for ${user.address}`);
        console.log(`[${new Date().toISOString()}] [Scheduler] Reason: ${proposal.reason}`);
      }
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] [Scheduler] Error in cycle:`, error);
  } finally {
    isRunning = false;
  }

  console.log(`\n[${new Date().toISOString()}] [Scheduler] Cycle complete`);
}

export function startScheduler(): void {
  console.log(`[${new Date().toISOString()}] [Scheduler] Starting cron job — runs every 6 hours`);

  // Run immediately on start
  runOnce();

  // Then every 6 hours
  cron.schedule("0 */6 * * *", () => {
    runOnce();
  });
}
