import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/app/lib/rate-limit";

const AGENT_URL = process.env.AGENT_SERVICE_URL || "http://localhost:3001";

// Mock APY data -- used as fallback when agent is unavailable
function getMockAPYs() {
  return {
    timestamp: new Date().toISOString(),
    sovryn: {
      RBTC: { apy: 4.2 + (Math.random() - 0.5) * 0.4, tvl: 2800000, risk: "low" },
      DOC: { apy: 8.7 + (Math.random() - 0.5) * 0.6, tvl: 1200000, risk: "low" },
    },
    tropykus: {
      RBTC: { apy: 3.8 + (Math.random() - 0.5) * 0.3, tvl: 1600000, risk: "low" },
      USDRIF: { apy: 9.1 + (Math.random() - 0.5) * 0.5, tvl: 780000, risk: "low" },
    },
    moneyonchain: {
      DOC: { apy: 6.2 + (Math.random() - 0.5) * 0.4, tvl: 3200000, risk: "low" },
      BPRO: { apy: 15.8 + (Math.random() - 0.5) * 1.0, tvl: 2100000, risk: "medium" },
      MOC: { apy: 28.4 + (Math.random() - 0.5) * 2.0, tvl: 890000, risk: "high" },
    },
  };
}

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
  if (!rateLimit(ip, 100)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    // Try agent API first
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`${AGENT_URL}/api/apys`, {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
  } catch {
    // Agent not available, fall back to mock
  }

  console.warn("[apys] Agent unavailable, using mock data");
  const data = getMockAPYs();
  return NextResponse.json({ data, cached: false, timestamp: new Date().toISOString() });
}
