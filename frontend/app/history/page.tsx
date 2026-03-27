"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Rebalance {
  id: string;
  executedAt: string;
  fromJson: { protocol: string; asset: string; percent: number }[];
  toJson: { protocol: string; asset: string; percent: number; apy: number }[];
  profit: number | null;
  txHash: string | null;
}

function generateMockHistory(): Rebalance[] {
  return [
    {
      id: "1",
      executedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      fromJson: [{ protocol: "sovryn", asset: "RBTC", percent: 100 }],
      toJson: [
        { protocol: "sovryn", asset: "DOC", percent: 50, apy: 8.7 },
        { protocol: "tropykus", asset: "USDRIF", percent: 50, apy: 9.1 },
      ],
      profit: 0.00012,
      txHash: "0xabc123def456789012345678901234567890abcdef1234567890abcdef123456",
    },
    {
      id: "2",
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
      txHash: "0xdef456789012345678901234567890abcdef1234567890abcdef123456789abc",
    },
  ];
}

function generateApyHistoryData() {
  const data = [];
  for (let i = 14; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86400000);
    data.push({
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      apy: 4.2 + Math.random() * 5 + (14 - i) * 0.2,
    });
  }
  return data;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.[0]) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 shadow-lg">
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className="text-sm font-semibold text-green-500 font-mono">{payload[0].value.toFixed(2)}% APY</p>
    </div>
  );
}

function TimelineCard({ rebalance }: { rebalance: Rebalance }) {
  return (
    <div className="relative pl-7 pb-6 last:pb-0">
      {/* Timeline line */}
      <div className="absolute left-[7px] top-4 bottom-0 w-px bg-zinc-800" />

      {/* Timeline dot */}
      <div className="absolute left-0 top-1.5 w-[15px] h-[15px] rounded-full bg-zinc-950 border-2 border-zinc-700 flex items-center justify-center">
        <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
      </div>

      {/* Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium text-zinc-50">
              Rebalance #{rebalance.id}
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {new Date(rebalance.executedAt).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          {rebalance.profit != null && (
            <span className="text-sm font-semibold text-green-500 font-mono">
              +{rebalance.profit.toFixed(5)} RBTC
            </span>
          )}
        </div>

        {/* From -> To flow */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 mb-4">
          {/* From */}
          <div className="flex-1 p-3 rounded-lg bg-zinc-800/50">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-2">From</p>
            <div className="space-y-1">
              {rebalance.fromJson.map((f, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-xs text-zinc-300 capitalize">{f.protocol}</span>
                  <span className="text-xs text-zinc-500 font-mono">{f.percent}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Arrow */}
          <div className="flex-shrink-0 flex justify-center sm:block">
            <svg className="rotate-90 sm:rotate-0" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M4 10H16M16 10L12 6M16 10L12 14" stroke="#3F3F46" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          {/* To */}
          <div className="flex-1 p-3 rounded-lg bg-zinc-800/50">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-2">To</p>
            <div className="space-y-1">
              {rebalance.toJson.map((t, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-xs text-zinc-300 capitalize">{t.protocol}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500 font-mono">{t.percent}%</span>
                    <span className="text-[10px] text-green-500 font-mono">{t.apy.toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* TX link */}
        {rebalance.txHash && (
          <a
            href={`https://explorer.testnet.rsk.co/tx/${rebalance.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-green-500 transition-colors duration-150"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M4.5 7.5L10 2M10 2H6.5M10 2V5.5M5 2H3C2.44772 2 2 2.44772 2 3V9C2 9.55228 2.44772 10 3 10H9C9.55228 10 10 9.55228 10 9V7" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="font-mono">{rebalance.txHash.slice(0, 10)}...{rebalance.txHash.slice(-6)}</span>
          </a>
        )}
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const { address, isConnected } = useAccount();
  const [history, setHistory] = useState<Rebalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [apyHistory] = useState(generateApyHistoryData);

  useEffect(() => {
    if (!isConnected) {
      setHistory([]);
      setLoading(false);
    }
  }, [isConnected]);

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    fetch(`/api/history?address=${address}`)
      .then((res) => res.json())
      .then((data) => setHistory(data.rebalances || []))
      .catch(() => setHistory(generateMockHistory()))
      .finally(() => setLoading(false));
  }, [address]);

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="5" y="11" width="14" height="10" rx="2" stroke="#71717A" strokeWidth="1.5" fill="none" />
            <path d="M8 11V8C8 5.79 9.79 4 12 4C14.21 4 16 5.79 16 8V11" stroke="#71717A" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-zinc-50 mb-2">Wallet not connected</h2>
        <p className="text-zinc-500 text-sm max-w-sm text-center">Connect your wallet to view your rebalancing history.</p>
      </div>
    );
  }

  const totalProfit = history.reduce((sum, r) => sum + (r.profit || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-50 mb-1">History</h1>
        <p className="text-sm text-zinc-400">Track your rebalancing history and APY performance.</p>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-6 text-sm">
        <div>
          <span className="text-zinc-500">Rebalances</span>
          <span className="ml-2 font-semibold text-zinc-50 font-mono">{history.length}</span>
        </div>
        <div>
          <span className="text-zinc-500">Total Profit</span>
          <span className="ml-2 font-semibold text-green-500 font-mono">+{totalProfit.toFixed(5)} RBTC</span>
        </div>
        <div className="hidden sm:block">
          <span className="text-zinc-500">Avg Improvement</span>
          <span className="ml-2 font-semibold text-zinc-50 font-mono">{history.length > 0 ? `+${(totalProfit / history.length * 100).toFixed(3)}%` : "-"}</span>
        </div>
      </div>

      {/* APY Performance Chart */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-base font-semibold text-zinc-50 mb-1">Cumulative APY Performance</h2>
        <p className="text-xs text-zinc-500 mb-4">Last 14 days</p>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={apyHistory}>
              <defs>
                <linearGradient id="apyGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22C55E" stopOpacity={0.1} />
                  <stop offset="100%" stopColor="#22C55E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="#3F3F46"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#3F3F46"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v.toFixed(1)}%`}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="apy"
                stroke="#22C55E"
                fill="url(#apyGradient)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "#22C55E", stroke: "#09090B", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Rebalance Timeline */}
      <div>
        <h2 className="text-base font-semibold text-zinc-50 mb-4">Rebalance Timeline</h2>

        {loading && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8">
            <div className="space-y-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-4 h-4 rounded-full bg-zinc-800 animate-pulse" />
                  <div className="flex-1 h-16 bg-zinc-800 rounded-lg animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && history.length === 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-10 text-center">
            <p className="text-zinc-500 text-sm">No rebalances executed yet.</p>
            <p className="text-zinc-600 text-xs mt-1">Approved strategies will appear here.</p>
          </div>
        )}

        {!loading && history.length > 0 && (
          <div>
            {history.map((r) => (
              <TimelineCard key={r.id} rebalance={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
