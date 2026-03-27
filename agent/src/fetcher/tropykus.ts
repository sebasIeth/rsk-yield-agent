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

const CTOKEN_ABI = [
  "function supplyRatePerBlock() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function exchangeRateStored() view returns (uint256)",
  "function getCash() view returns (uint256)",
];

// Always read from mainnet (view calls are free, no wallet needed)
const RSK_MAINNET_RPC = "https://public-node.rsk.co";

// Tropykus kRBTC & kUSDRIF — lowercase to avoid RSK EIP-1191 checksum issues
const KRBTC_ADDRESS = "0x0aeadb9d4c6a80462a47e87e76e487fa8b9a37d7";
const KUSDRIF_ADDRESS = "0xddf3ce45fcf080df61ee61dac5ddefef7ed4f46c";
const BLOCKS_PER_YEAR = 1051200;

export interface AssetAPY {
  apy: number;
  tvl: number;
  risk: "low" | "medium" | "high";
}

export interface TropykusAPYs {
  RBTC: AssetAPY;
  USDRIF: AssetAPY;
}

export async function fetchTropykusAPYs(rpcUrl: string): Promise<TropykusAPYs> {
  try {
    const provider = new ethers.JsonRpcProvider(RSK_MAINNET_RPC);
    const kRBTC = new ethers.Contract(KRBTC_ADDRESS, CTOKEN_ABI, provider);
    const kUSDRIF = new ethers.Contract(KUSDRIF_ADDRESS, CTOKEN_ABI, provider);

    const [rbtcRate, rbtcCash, usdrifRate, usdrifCash] = await Promise.all([
      kRBTC.supplyRatePerBlock(),
      kRBTC.getCash(),
      kUSDRIF.supplyRatePerBlock(),
      kUSDRIF.getCash(),
    ]);

    const apyRBTC = (Number(rbtcRate) / 1e18) * BLOCKS_PER_YEAR * 100;
    const tvlRBTC = Number(ethers.formatEther(rbtcCash)); // getCash returns underlying asset amount
    const apyUSDRIF = (Number(usdrifRate) / 1e18) * BLOCKS_PER_YEAR * 100;
    const tvlUSDRIF = Number(ethers.formatEther(usdrifCash));

    console.log(`[${new Date().toISOString()}] [Tropykus] Live data — RBTC APY: ${apyRBTC.toFixed(2)}%, TVL: ${tvlRBTC.toFixed(4)} RBTC | USDRIF APY: ${apyUSDRIF.toFixed(2)}%, TVL: ${tvlUSDRIF.toFixed(2)}`);

    return {
      RBTC: { apy: sanitizeAPY(apyRBTC), tvl: sanitizeTVL(tvlRBTC * 95000), risk: "low" },
      USDRIF: { apy: sanitizeAPY(apyUSDRIF), tvl: sanitizeTVL(tvlUSDRIF), risk: "low" },
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.warn(`[${new Date().toISOString()}] [Tropykus] WARN: Falling back to mock data — ${errMsg}`);
    return {
      RBTC: { apy: 3.8, tvl: 1600000, risk: "low" },
      USDRIF: { apy: 9.1, tvl: 780000, risk: "low" },
    };
  }
}
