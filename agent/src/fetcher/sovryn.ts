import { ethers } from "ethers";

function sanitizeAPY(value: unknown): number {
  const num = Number(value);
  if (isNaN(num) || num < 0 || num > 200) return 0;
  return parseFloat(num.toFixed(4));
}

function sanitizeTVL(value: unknown): number {
  const num = Number(value);
  if (isNaN(num) || num < 0 || num > 100_000_000_000) return 0;
  return Math.round(num);
}

const SOVRYN_LOAN_TOKEN_ABI = [
  "function supplyInterestRate() view returns (uint256)",
  "function totalAssetSupply() view returns (uint256)",
];

// Always read from mainnet (view calls are free, no wallet needed)
const RSK_MAINNET_RPC = "https://public-node.rsk.co";

// Sovryn iRBTC & iDOC — lowercase to avoid RSK EIP-1191 checksum issues
const IRBTC_ADDRESS = "0xa9dcdc63eabb8a2b6f39d7ff9429d88340044a7a";
const IDOC_ADDRESS = "0xd8d25f03ebba94e15df2ed4d6d38276b595593c1";
const BLOCKS_PER_YEAR = 1051200; // ~30s/block on RSK

export interface AssetAPY {
  apy: number;
  tvl: number;
  risk: "low" | "medium" | "high";
}

export interface SovrynAPYs {
  RBTC: AssetAPY;
  DOC: AssetAPY;
}

export async function fetchSovrynAPYs(rpcUrl: string): Promise<SovrynAPYs> {
  try {
    const provider = new ethers.JsonRpcProvider(RSK_MAINNET_RPC);
    const iRBTC = new ethers.Contract(IRBTC_ADDRESS, SOVRYN_LOAN_TOKEN_ABI, provider);
    const iDOC = new ethers.Contract(IDOC_ADDRESS, SOVRYN_LOAN_TOKEN_ABI, provider);

    const [rbtcRate, rbtcSupply, docRate, docSupply] = await Promise.all([
      iRBTC.supplyInterestRate(),
      iRBTC.totalAssetSupply(),
      iDOC.supplyInterestRate(),
      iDOC.totalAssetSupply(),
    ]);

    // Sovryn's supplyInterestRate() returns annual rate in wei (not per-block)
    // So we just convert from wei to percentage, no need to multiply by BLOCKS_PER_YEAR
    const apyRBTC = Number(rbtcRate) / 1e18;
    const tvlRBTC = Number(ethers.formatEther(rbtcSupply));
    const apyDOC = Number(docRate) / 1e18;
    const tvlDOC = Number(ethers.formatEther(docSupply));

    console.log(`[${new Date().toISOString()}] [Sovryn] Live data — RBTC APY: ${apyRBTC.toFixed(2)}%, DOC APY: ${apyDOC.toFixed(2)}%`);

    return {
      RBTC: { apy: sanitizeAPY(apyRBTC), tvl: sanitizeTVL(tvlRBTC * 95000), risk: "low" },
      DOC: { apy: sanitizeAPY(apyDOC), tvl: sanitizeTVL(tvlDOC), risk: "low" },
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.warn(`[${new Date().toISOString()}] [Sovryn] WARN: Falling back to mock data — ${errMsg}`);
    return {
      RBTC: { apy: 4.2, tvl: 2800000, risk: "low" },
      DOC: { apy: 8.7, tvl: 1200000, risk: "low" },
    };
  }
}
