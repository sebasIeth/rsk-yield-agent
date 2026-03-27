import { ProtocolAPYs } from "../fetcher";

export interface Allocation {
  protocol: string;
  asset: string;
  percent: number;
  current_apy: number;
}

export interface UserProfile {
  address: string;
  risk: "conservative" | "balanced" | "aggressive";
  capital_rbtc: number;
}

export interface AgentContext {
  user_profile: UserProfile;
  current_allocation: Allocation[];
  live_apys: ProtocolAPYs;
  gas_cost_estimate_rbtc: number;
  rbtc_price_usd: number;
}

export interface StrategyProposal {
  should_rebalance: boolean;
  reason: string;
  new_allocation: {
    protocol: string;
    asset: string;
    percent: number;
    apy: number;
  }[];
  estimated_apy: number;
  current_apy: number;
  risk_level: string;
  confidence: number;
}

const SYSTEM_PROMPT = `You are an expert DeFi yield optimization agent operating on the Rootstock network (Bitcoin Layer 2).
Your goal is to maximize yield for users while strictly respecting their risk profile.

Rules you MUST follow:
1. NEVER allocate more than 80% of capital to a single protocol
2. NEVER recommend a 'high' risk pool for a 'conservative' profile
3. For 'balanced' profiles: max 30% in high-risk pools
4. For 'aggressive' profiles: max 60% in high-risk pools
5. Only recommend rebalancing if the estimated APY improvement exceeds 0.5% AND gas cost is < 5% of monthly gain
6. All percentages in your allocation MUST sum to exactly 100
7. You MUST respond ONLY with valid JSON, no markdown, no explanation outside the JSON

Risk classification:
- low: lending stablecoins (DOC, USDRIF), RBTC lending in established protocols
- medium: BPRO leverage products, AMM LP positions
- high: governance token staking (MOC, SOV), new pools with high APY

Response format:
{
  "should_rebalance": boolean,
  "reason": "string explaining the rationale",
  "new_allocation": [
    { "protocol": "string", "asset": "string", "percent": number, "apy": number }
  ],
  "estimated_apy": number,
  "current_apy": number,
  "risk_level": "conservative" | "balanced" | "aggressive",
  "confidence": number (0-1)
}`;

/**
 * Strip any non-numeric characters (except dot and minus) from APY/TVL values
 * before building the prompt context. The user message should only contain
 * sanitized numeric data to prevent prompt injection via external data sources.
 */
function sanitizeNumeric(value: unknown): number {
  const str = String(value).replace(/[^0-9.\-]/g, "");
  const num = Number(str);
  return isNaN(num) ? 0 : num;
}

function sanitizeApysForPrompt(apys: ProtocolAPYs): ProtocolAPYs {
  const sanitizeAsset = (asset: { apy: number; tvl: number; risk: "low" | "medium" | "high" }) => ({
    apy: sanitizeNumeric(asset.apy),
    tvl: sanitizeNumeric(asset.tvl),
    risk: asset.risk,
  });

  return {
    timestamp: apys.timestamp,
    sovryn: {
      RBTC: sanitizeAsset(apys.sovryn.RBTC),
      DOC: sanitizeAsset(apys.sovryn.DOC),
    },
    tropykus: {
      RBTC: sanitizeAsset(apys.tropykus.RBTC),
      USDRIF: sanitizeAsset(apys.tropykus.USDRIF),
    },
    moneyonchain: {
      DOC: sanitizeAsset(apys.moneyonchain.DOC),
      BPRO: sanitizeAsset(apys.moneyonchain.BPRO),
      MOC: sanitizeAsset(apys.moneyonchain.MOC),
    },
  };
}

export function buildStrategyPrompt(context: AgentContext): { system: string; user: string } {
  const currentApy =
    context.current_allocation.length > 0
      ? context.current_allocation.reduce((sum, a) => sum + a.current_apy * (a.percent / 100), 0)
      : 0;

  // Sanitize all APY/TVL data before embedding in the prompt
  const sanitizedApys = sanitizeApysForPrompt(context.live_apys);

  const userMessage = JSON.stringify(
    {
      timestamp: new Date().toISOString(),
      user_profile: context.user_profile,
      current_allocation: context.current_allocation,
      current_weighted_apy: parseFloat(currentApy.toFixed(2)),
      live_apys: sanitizedApys,
      gas_cost_estimate_rbtc: sanitizeNumeric(context.gas_cost_estimate_rbtc),
      rbtc_price_usd: sanitizeNumeric(context.rbtc_price_usd),
    },
    null,
    2
  );

  return {
    system: SYSTEM_PROMPT,
    user: userMessage,
  };
}
