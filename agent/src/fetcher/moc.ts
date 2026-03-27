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

export interface AssetAPY {
  apy: number;
  tvl: number;
  risk: "low" | "medium" | "high";
}

export interface MOCAPYs {
  DOC: AssetAPY;
  BPRO: AssetAPY;
  MOC: AssetAPY;
}

export async function fetchMOCAPYs(): Promise<MOCAPYs> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch("https://api-operations.moneyonchain.com/api/v1/moc-state", {
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`MOC API returned ${response.status}`);
    }

    const data = (await response.json()) as Record<string, number>;
    console.log(`[${new Date().toISOString()}] [MoneyOnChain] Live data fetched from API`);

    return {
      DOC: {
        apy: sanitizeAPY(data.docApy ?? 6.2),
        tvl: sanitizeTVL(data.docTvl ?? 3200000),
        risk: "low",
      },
      BPRO: {
        apy: sanitizeAPY(data.bproApy ?? 15.8),
        tvl: sanitizeTVL(data.bproTvl ?? 2100000),
        risk: "medium",
      },
      MOC: {
        apy: sanitizeAPY(data.mocApy ?? 28.4),
        tvl: sanitizeTVL(data.mocTvl ?? 890000),
        risk: "high",
      },
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.warn(`[${new Date().toISOString()}] [MoneyOnChain] WARN: Falling back to mock data — ${errMsg}`);
    return {
      DOC: { apy: 6.2, tvl: 3200000, risk: "low" },
      BPRO: { apy: 15.8, tvl: 2100000, risk: "medium" },
      MOC: { apy: 28.4, tvl: 890000, risk: "high" },
    };
  }
}
