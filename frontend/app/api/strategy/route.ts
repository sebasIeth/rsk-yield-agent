import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/app/lib/rate-limit";

const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const VALID_ACTIONS = ["approve", "reject", "trigger"] as const;
const AGENT_URL = process.env.AGENT_SERVICE_URL || "http://localhost:3001";

// In-memory fallback when Prisma/DB is not available
const memoryStore = new Map<string, any>();

let prisma: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("@/app/lib/prisma");
  prisma = mod.prisma;
} catch {
  console.warn("[strategy] Prisma not available, using in-memory store");
}

function checkOrigin(request: NextRequest): NextResponse | null {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host && !origin.includes(host)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

function createDemoStrategy(address: string) {
  return {
    id: `demo-strategy-${Date.now()}`,
    userAddress: address,
    reason:
      "Tropykus USDRIF offers 9.1% vs current 4.2% in Sovryn RBTC. Net gain after gas: 4.4% APY improvement. Diversifying across 3 protocols reduces single-protocol risk.",
    estimatedApy: 8.9,
    currentApy: 4.2,
    confidence: 0.85,
    status: "pending",
    allocationsJson: [
      { protocol: "sovryn", asset: "DOC", percent: 40, apy: 8.7 },
      { protocol: "tropykus", asset: "USDRIF", percent: 40, apy: 9.1 },
      { protocol: "moneyonchain", asset: "DOC", percent: 20, apy: 6.2 },
    ],
    createdAt: new Date().toISOString(),
  };
}

async function findPendingStrategy(address: string) {
  // Try Prisma first
  if (prisma) {
    try {
      const strategy = await prisma.strategy.findFirst({
        where: { userAddress: address, status: "pending" },
        orderBy: { createdAt: "desc" },
      });
      return strategy;
    } catch (err) {
      console.warn("[strategy] Prisma query failed, falling back to memory:", err);
    }
  }

  // Fallback to in-memory
  const entries = Array.from(memoryStore.values());
  return entries.find((s: any) => s.userAddress === address && s.status === "pending") || null;
}

async function findStrategyById(strategyId: string) {
  if (prisma) {
    try {
      return await prisma.strategy.findUnique({ where: { id: strategyId } });
    } catch (err) {
      console.warn("[strategy] Prisma query failed, falling back to memory:", err);
    }
  }
  return memoryStore.get(strategyId) || null;
}

async function saveStrategy(strategy: any) {
  if (prisma) {
    try {
      // Ensure user exists
      await prisma.user.upsert({
        where: { address: strategy.userAddress },
        update: {},
        create: { address: strategy.userAddress },
      });
      const saved = await prisma.strategy.create({
        data: {
          id: strategy.id,
          userAddress: strategy.userAddress,
          reason: strategy.reason,
          estimatedApy: strategy.estimatedApy,
          currentApy: strategy.currentApy,
          confidence: strategy.confidence,
          status: strategy.status,
          allocationsJson: strategy.allocationsJson,
        },
      });
      return saved;
    } catch (err) {
      console.warn("[strategy] Prisma save failed, falling back to memory:", err);
    }
  }
  memoryStore.set(strategy.id, strategy);
  return strategy;
}

async function updateStrategyStatus(strategyId: string, status: string) {
  if (prisma) {
    try {
      return await prisma.strategy.update({
        where: { id: strategyId },
        data: { status },
      });
    } catch (err) {
      console.warn("[strategy] Prisma update failed, falling back to memory:", err);
    }
  }
  const s = memoryStore.get(strategyId);
  if (s) {
    s.status = status;
    memoryStore.set(strategyId, s);
  }
  return s;
}

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
  if (!rateLimit(ip, 100)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const address = request.nextUrl.searchParams.get("address");

  if (!address) {
    return NextResponse.json({ error: "Address required" }, { status: 400 });
  }

  if (!ETH_ADDRESS_REGEX.test(address)) {
    return NextResponse.json({ error: "Invalid Ethereum address format" }, { status: 400 });
  }

  try {
    const userStrategy = await findPendingStrategy(address);

    if (userStrategy) {
      return NextResponse.json({ strategy: userStrategy });
    }

    // No pending strategy — create a demo for first-time users
    const demo = createDemoStrategy(address);
    await saveStrategy(demo);
    return NextResponse.json({ strategy: demo });
  } catch (error) {
    console.error("[strategy] GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
  if (!rateLimit(ip, 30)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const originCheck = checkOrigin(request);
  if (originCheck) return originCheck;

  // Body size check
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength) > 10240) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  try {
    const body = await request.json();
    const { action, strategyId, userAddress, riskProfile } = body;

    if (!action || !VALID_ACTIONS.includes(action)) {
      return NextResponse.json({ error: "Invalid action. Must be one of: approve, reject, trigger" }, { status: 400 });
    }

    if ((action === "approve" || action === "reject") && (!strategyId || typeof strategyId !== "string" || strategyId.trim() === "")) {
      return NextResponse.json({ error: "strategyId is required for approve/reject" }, { status: 400 });
    }

    if (userAddress && !ETH_ADDRESS_REGEX.test(userAddress)) {
      return NextResponse.json({ error: "Invalid Ethereum address format" }, { status: 400 });
    }

    if (action === "trigger") {
      if (!userAddress) {
        return NextResponse.json({ error: "userAddress is required for trigger" }, { status: 400 });
      }

      // Try calling the agent's analyze endpoint
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        const res = await fetch(`${AGENT_URL}/api/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userAddress, riskProfile: riskProfile || "balanced" }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.ok) {
          const agentData = await res.json();
          const raw = agentData.strategy || agentData;
          // Map agent snake_case to frontend camelCase
          const strategy = {
            id: raw.id || `strategy-${Date.now()}`,
            userAddress: raw.userAddress || userAddress,
            reason: raw.reason || "",
            estimatedApy: raw.estimatedApy ?? raw.estimated_apy ?? 0,
            currentApy: raw.currentApy ?? raw.current_apy ?? 0,
            confidence: raw.confidence ?? 0,
            status: raw.status || "pending",
            allocationsJson: raw.allocationsJson || raw.new_allocation || [],
            createdAt: raw.createdAt || new Date().toISOString(),
          };

          const saved = await saveStrategy(strategy);
          return NextResponse.json({ success: true, strategy: saved });
        }
      } catch {
        console.warn("[strategy] Agent unavailable for analysis, using demo strategy");
      }

      // Fallback: create demo strategy
      const newStrategy = createDemoStrategy(userAddress);
      const saved = await saveStrategy(newStrategy);
      return NextResponse.json({ success: true, strategy: saved });
    }

    if (action === "approve") {
      const strategy = await findStrategyById(strategyId);
      if (!strategy) {
        return NextResponse.json({ error: "Strategy not found" }, { status: 404 });
      }
      if (strategy.userAddress !== userAddress) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      // Execute on-chain via agent keeper
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000); // 60s for on-chain tx

        const execRes = await fetch(`${AGENT_URL}/api/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userAddress,
            allocations: strategy.allocationsJson,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (execRes.ok) {
          const execData = await execRes.json();
          await updateStrategyStatus(strategyId, "executed");
          return NextResponse.json({
            success: true,
            status: "executed",
            txHash: execData.txHash,
            blockNumber: execData.blockNumber,
          });
        }

        const errData = await execRes.json().catch(() => ({ error: "Unknown error" }));
        return NextResponse.json({
          success: false,
          status: "failed",
          error: errData.error || "On-chain execution failed",
        }, { status: 500 });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        // If agent is down, fall back to approved status
        await updateStrategyStatus(strategyId, "approved");
        return NextResponse.json({
          success: true,
          status: "approved",
          note: "Strategy approved but agent unavailable for execution. Will execute on next cycle.",
          error: errMsg,
        });
      }
    }

    if (action === "reject") {
      const strategy = await findStrategyById(strategyId);
      if (!strategy) {
        return NextResponse.json({ error: "Strategy not found" }, { status: 404 });
      }
      if (strategy.userAddress !== userAddress) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      await updateStrategyStatus(strategyId, "rejected");
      return NextResponse.json({ success: true, status: "rejected" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[strategy] POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
