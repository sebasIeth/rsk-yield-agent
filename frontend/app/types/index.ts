export interface Allocation {
  protocol: string;
  asset: string;
  percent: number;
  apy: number;
}

export interface Strategy {
  id: string;
  userAddress: string;
  reason: string;
  estimatedApy: number;
  currentApy: number;
  confidence: number;
  status: "pending" | "approved" | "rejected" | "executed" | "failed";
  allocationsJson: Allocation[];
  createdAt: string;
}

export interface AssetAPY {
  apy: number;
  tvl: number;
  risk: "low" | "medium" | "high";
}

export interface ProtocolAPYs {
  timestamp: string;
  sovryn: { RBTC: AssetAPY; DOC: AssetAPY };
  tropykus: { RBTC: AssetAPY; USDRIF: AssetAPY };
  moneyonchain: { DOC: AssetAPY; BPRO: AssetAPY; MOC: AssetAPY };
}
