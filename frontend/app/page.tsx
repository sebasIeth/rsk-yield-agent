"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { VaultCard } from "./components/VaultCard";
import { ProtocolTable } from "./components/ProtocolTable";
import { APYChart } from "./components/APYChart";

interface AssetData { apy: number; tvl: number; risk: string }

function StatCard({
  label,
  value,
  subtext,
}: {
  label: string;
  value: string;
  subtext?: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-lg sm:text-xl font-semibold text-zinc-50 font-mono tabular-nums">{value}</p>
      {subtext && <p className="text-xs text-zinc-500 mt-0.5 truncate">{subtext}</p>}
    </div>
  );
}

function formatTvl(tvl: number): string {
  if (tvl >= 1_000_000) return "$" + (tvl / 1_000_000).toFixed(2) + "M";
  if (tvl >= 1_000) return "$" + (tvl / 1_000).toFixed(1) + "K";
  return "$" + tvl.toFixed(0);
}

export default function Dashboard() {
  const { isConnected } = useAccount();
  const [stats, setStats] = useState({ totalTvl: 0, bestApy: 0, bestApyName: "", avgApy: 0, pools: 0 });

  useEffect(() => {
    fetch("/api/apys")
      .then((r) => r.json())
      .then((json) => {
        const data = json.data;
        if (!data) return;

        const all: { name: string; apy: number; tvl: number }[] = [];
        for (const [asset, info] of Object.entries(data.sovryn || {})) {
          const d = info as AssetData;
          all.push({ name: `Sovryn ${asset}`, apy: d.apy, tvl: d.tvl });
        }
        for (const [asset, info] of Object.entries(data.tropykus || {})) {
          const d = info as AssetData;
          all.push({ name: `Tropykus ${asset}`, apy: d.apy, tvl: d.tvl });
        }
        for (const [asset, info] of Object.entries(data.moneyonchain || {})) {
          const d = info as AssetData;
          all.push({ name: `MoneyOnChain ${asset}`, apy: d.apy, tvl: d.tvl });
        }

        const totalTvl = all.reduce((sum, p) => sum + p.tvl, 0);
        const best = all.reduce((max, p) => (p.apy > max.apy ? p : max), all[0]);
        const avgApy = all.length > 0 ? all.reduce((sum, p) => sum + p.apy, 0) / all.length : 0;

        setStats({
          totalTvl,
          bestApy: best?.apy || 0,
          bestApyName: best?.name || "",
          avgApy,
          pools: all.length,
        });
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-zinc-50 mb-1">
          {isConnected ? "Dashboard" : "RSK Yield Agent"}
        </h1>
        <p className="text-sm text-zinc-400">
          {isConnected
            ? "Monitor DeFi yields across Rootstock protocols in real time."
            : "Find the best returns across Rootstock DeFi. Connect your wallet to get started."}
        </p>
      </div>

      {/* Stats bar */}
      <section aria-labelledby="stats-heading">
      <h2 id="stats-heading" className="sr-only">Key Statistics</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Total TVL"
          value={stats.totalTvl > 0 ? formatTvl(stats.totalTvl) : "—"}
          subtext="Across 3 protocols"
        />
        <StatCard
          label="Best APY"
          value={stats.bestApy > 0 ? stats.bestApy.toFixed(1) + "%" : "—"}
          subtext={stats.bestApyName || "Loading..."}
        />
        <StatCard
          label="Active Protocols"
          value="3"
          subtext={`${stats.pools} yield pools`}
        />
        <StatCard
          label={isConnected ? "Avg APY" : "Avg APY"}
          value={stats.avgApy > 0 ? stats.avgApy.toFixed(1) + "%" : "—"}
          subtext="Weighted average"
        />
      </div>
      </section>

      {/* Main grid */}
      <section aria-labelledby="vault-protocols-heading">
        <h2 id="vault-protocols-heading" className="sr-only">Vault and Protocol Data</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <VaultCard />
          </div>
          <div className="lg:col-span-2">
            <ProtocolTable />
          </div>
        </div>
      </section>

      {/* Chart */}
      <section aria-labelledby="apy-chart-heading">
        <h2 id="apy-chart-heading" className="sr-only">APY Chart</h2>
        <APYChart />
      </section>
    </div>
  );
}
