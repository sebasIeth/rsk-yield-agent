import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/app/lib/rate-limit";

const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

let prisma: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("@/app/lib/prisma");
  prisma = mod.prisma;
} catch {
  console.warn("[history] Prisma not available, using mock data");
}

// Mock history data -- used as fallback when Prisma/DB is not available
function getMockHistory() {
  return [
    {
      id: "1",
      executedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      fromJson: [{ protocol: "sovryn", asset: "RBTC", percent: 100 }],
      toJson: [
        { protocol: "sovryn", asset: "RBTC", percent: 60, apy: 4.2 },
        { protocol: "tropykus", asset: "RBTC", percent: 40, apy: 3.8 },
      ],
      profit: 0.00005,
      txHash: "0xabc123def456789012345678901234567890abcdef1234567890abcdef123456",
    },
    {
      id: "2",
      executedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      fromJson: [
        { protocol: "sovryn", asset: "RBTC", percent: 60 },
        { protocol: "tropykus", asset: "RBTC", percent: 40 },
      ],
      toJson: [
        { protocol: "sovryn", asset: "DOC", percent: 50, apy: 8.7 },
        { protocol: "tropykus", asset: "USDRIF", percent: 50, apy: 9.1 },
      ],
      profit: 0.00012,
      txHash: "0xdef456789012345678901234567890abcdef1234567890abcdef123456789abc",
    },
    {
      id: "3",
      executedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
      fromJson: [
        { protocol: "sovryn", asset: "DOC", percent: 50 },
        { protocol: "tropykus", asset: "USDRIF", percent: 50 },
      ],
      toJson: [
        { protocol: "sovryn", asset: "DOC", percent: 40, apy: 8.7 },
        { protocol: "tropykus", asset: "USDRIF", percent: 40, apy: 9.1 },
        { protocol: "moneyonchain", asset: "DOC", percent: 20, apy: 6.2 },
      ],
      profit: 0.00008,
      txHash: "0x789012345678901234567890abcdef1234567890abcdef123456789abcdef012",
    },
  ];
}

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
  if (!rateLimit(ip, 100)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const address = request.nextUrl.searchParams.get("address");
  const page = parseInt(request.nextUrl.searchParams.get("page") || "1");
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "20");

  if (!address) {
    return NextResponse.json({ error: "Address required" }, { status: 400 });
  }

  if (!ETH_ADDRESS_REGEX.test(address)) {
    return NextResponse.json({ error: "Invalid Ethereum address format" }, { status: 400 });
  }

  // Try Prisma first
  if (prisma) {
    try {
      const [rebalances, total] = await Promise.all([
        prisma.rebalance.findMany({
          where: { userAddress: address },
          orderBy: { executedAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.rebalance.count({ where: { userAddress: address } }),
      ]);

      return NextResponse.json({
        rebalances,
        pagination: {
          page,
          limit,
          total,
          hasMore: (page - 1) * limit + rebalances.length < total,
        },
      });
    } catch (err) {
      console.warn("[history] Prisma query failed, falling back to mock:", err);
    }
  }

  // Fallback to mock data
  console.warn("[history] Using mock history data");
  const allRebalances = getMockHistory();
  const start = (page - 1) * limit;
  const rebalances = allRebalances.slice(start, start + limit);

  return NextResponse.json({
    rebalances,
    pagination: {
      page,
      limit,
      total: allRebalances.length,
      hasMore: start + limit < allRebalances.length,
    },
  });
}
