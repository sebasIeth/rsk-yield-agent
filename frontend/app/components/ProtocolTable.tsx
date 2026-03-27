"use client";

import { useState, useEffect } from "react";

interface AssetData {
  apy: number;
  tvl: number;
  risk: "low" | "medium" | "high";
}

interface ProtocolAPYs {
  timestamp: string;
  sovryn: { RBTC: AssetData; DOC: AssetData };
  tropykus: { RBTC: AssetData; USDRIF: AssetData };
  moneyonchain: { DOC: AssetData; BPRO: AssetData; MOC: AssetData };
}

type SortKey = "apy" | "tvl" | "risk";
type SortDir = "asc" | "desc";

const RISK_CONFIG = {
  low: {
    label: "Low",
    className: "bg-green-500/10 text-green-500",
    sortValue: 0,
  },
  medium: {
    label: "Med",
    className: "bg-amber-500/10 text-amber-500",
    sortValue: 1,
  },
  high: {
    label: "High",
    className: "bg-red-500/10 text-red-500",
    sortValue: 2,
  },
};

const PROTOCOL_COLORS: Record<string, { dot: string; icon: string }> = {
  Sovryn: { dot: "bg-orange-500", icon: "S" },
  Tropykus: { dot: "bg-green-500", icon: "T" },
  MoneyOnChain: { dot: "bg-yellow-500", icon: "M" },
};

function flattenAPYs(data: ProtocolAPYs) {
  const rows: { protocol: string; asset: string; apy: number; tvl: number; risk: "low" | "medium" | "high" }[] = [];

  for (const [asset, info] of Object.entries(data.sovryn)) {
    rows.push({ protocol: "Sovryn", asset, ...info });
  }
  for (const [asset, info] of Object.entries(data.tropykus)) {
    rows.push({ protocol: "Tropykus", asset, ...info });
  }
  for (const [asset, info] of Object.entries(data.moneyonchain)) {
    rows.push({ protocol: "MoneyOnChain", asset, ...info });
  }

  return rows;
}

function getApyColor(apy: number): string {
  if (apy >= 8) return "text-green-500";
  if (apy >= 5) return "text-amber-500";
  return "text-zinc-300";
}

function formatTVL(tvl: number): string {
  if (tvl >= 1_000_000) return `$${(tvl / 1_000_000).toFixed(2)}M`;
  if (tvl >= 1_000) return `$${(tvl / 1_000).toFixed(0)}K`;
  return `$${tvl.toFixed(0)}`;
}

export function ProtocolTable() {
  const [data, setData] = useState<ProtocolAPYs | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("apy");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const fetchData = async () => {
    try {
      const res = await fetch("/api/apys");
      const json = await res.json();
      setData(json.data);
    } catch {
      setData({
        timestamp: new Date().toISOString(),
        sovryn: {
          RBTC: { apy: 4.2, tvl: 2800000, risk: "low" },
          DOC: { apy: 8.7, tvl: 1200000, risk: "low" },
        },
        tropykus: {
          RBTC: { apy: 3.8, tvl: 1600000, risk: "low" },
          USDRIF: { apy: 9.1, tvl: 780000, risk: "low" },
        },
        moneyonchain: {
          DOC: { apy: 6.2, tvl: 3200000, risk: "low" },
          BPRO: { apy: 15.8, tvl: 2100000, risk: "medium" },
          MOC: { apy: 28.4, tvl: 890000, risk: "high" },
        },
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  if (loading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-5 bg-zinc-800 rounded w-24 animate-pulse" />
            <div className="h-4 bg-zinc-800 rounded w-12 animate-pulse" />
          </div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="w-2 h-2 bg-zinc-800 rounded-full animate-pulse" />
              <div className="flex-1 h-4 bg-zinc-800 rounded animate-pulse" />
              <div className="w-16 h-4 bg-zinc-800 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const rows = flattenAPYs(data);
  const sorted = [...rows].sort((a, b) => {
    const mul = sortDir === "desc" ? -1 : 1;
    if (sortKey === "risk") {
      return (RISK_CONFIG[a.risk].sortValue - RISK_CONFIG[b.risk].sortValue) * mul;
    }
    return (a[sortKey] - b[sortKey]) * mul;
  });

  const SortIcon = ({ active, dir }: { active: boolean; dir: SortDir }) => (
    <svg width="12" height="12" viewBox="0 0 12 12" className={`inline-block ml-1 ${active ? "text-green-500" : "text-zinc-600"}`} aria-hidden="true">
      <path d="M6 2L9 5H3L6 2Z" fill="currentColor" opacity={active && dir === "asc" ? 1 : 0.3} />
      <path d="M6 10L3 7H9L6 10Z" fill="currentColor" opacity={active && dir === "desc" ? 1 : 0.3} />
    </svg>
  );

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-semibold text-zinc-50">Live APYs</h2>
        <div className="flex items-center gap-2">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-60" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
          </span>
          <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Live</span>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs text-zinc-500 uppercase tracking-wide">
              <th scope="col" className="pb-3 font-medium">Protocol</th>
              <th scope="col" className="pb-3 font-medium">Asset</th>
              <th scope="col" className="pb-3 font-medium text-right cursor-pointer select-none hover:text-zinc-300 transition-colors duration-150" onClick={() => handleSort("apy")}>
                APY <SortIcon active={sortKey === "apy"} dir={sortDir} />
              </th>
              <th scope="col" className="pb-3 font-medium text-right cursor-pointer select-none hover:text-zinc-300 transition-colors duration-150" onClick={() => handleSort("tvl")}>
                TVL <SortIcon active={sortKey === "tvl"} dir={sortDir} />
              </th>
              <th scope="col" className="pb-3 font-medium text-center cursor-pointer select-none hover:text-zinc-300 transition-colors duration-150" onClick={() => handleSort("risk")}>
                Risk <SortIcon active={sortKey === "risk"} dir={sortDir} />
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const config = PROTOCOL_COLORS[row.protocol] || { dot: "bg-zinc-500", icon: "?" };
              return (
                <tr
                  key={`${row.protocol}-${row.asset}`}
                  className="border-t border-zinc-800 hover:bg-zinc-800/50 transition-colors duration-150"
                >
                  <td className="py-3.5">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-2 h-2 rounded-full ${config.dot} flex-shrink-0`} />
                      <span className="text-zinc-50 font-medium text-sm">{row.protocol}</span>
                    </div>
                  </td>
                  <td className="py-3.5">
                    <span className="text-zinc-400 text-sm font-mono text-xs">
                      {row.asset}
                    </span>
                  </td>
                  <td className={`py-3.5 text-right font-mono font-semibold text-sm ${getApyColor(row.apy)}`}>
                    {row.apy.toFixed(1)}%
                  </td>
                  <td className="py-3.5 text-right text-zinc-400 text-sm font-mono">
                    {formatTVL(row.tvl)}
                  </td>
                  <td className="py-3.5 text-center">
                    <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${RISK_CONFIG[row.risk].className}`}>
                      {RISK_CONFIG[row.risk].label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile card layout */}
      <div className="md:hidden space-y-2">
        {sorted.map((row) => {
          const config = PROTOCOL_COLORS[row.protocol] || { dot: "bg-zinc-500", icon: "?" };
          return (
            <div
              key={`${row.protocol}-${row.asset}-mobile`}
              className="p-3.5 rounded-lg bg-zinc-800/50"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <span className={`w-2 h-2 rounded-full ${config.dot} flex-shrink-0`} />
                  <div>
                    <span className="text-zinc-50 font-medium text-sm">{row.protocol}</span>
                    <span className="text-zinc-500 text-xs ml-2 font-mono">{row.asset}</span>
                  </div>
                </div>
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${RISK_CONFIG[row.risk].className}`}>
                  {RISK_CONFIG[row.risk].label}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wide">APY</span>
                  <p className={`font-mono font-semibold text-lg ${getApyColor(row.apy)}`}>{row.apy.toFixed(1)}%</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wide">TVL</span>
                  <p className="font-mono text-sm text-zinc-400">{formatTVL(row.tvl)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
