"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { StrategyProposal } from "../components/StrategyProposal";
import type { Strategy } from "@/app/types";

function SkeletonCard() {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8">
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-4 bg-zinc-800 rounded w-36 animate-pulse" />
            <div className="h-3 bg-zinc-800 rounded w-24 animate-pulse" />
          </div>
          <div className="h-6 bg-zinc-800 rounded w-16 animate-pulse" />
        </div>
        <div className="flex items-center gap-4 p-5 rounded-lg bg-zinc-800/50">
          <div className="flex-1 text-center space-y-2">
            <div className="h-3 bg-zinc-800 rounded w-16 mx-auto animate-pulse" />
            <div className="h-8 bg-zinc-800 rounded w-20 mx-auto animate-pulse" />
          </div>
          <div className="w-8 h-3 bg-zinc-800 rounded animate-pulse" />
          <div className="flex-1 text-center space-y-2">
            <div className="h-3 bg-zinc-800 rounded w-16 mx-auto animate-pulse" />
            <div className="h-8 bg-zinc-800 rounded w-20 mx-auto animate-pulse" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-3 bg-zinc-800 rounded w-full animate-pulse" />
          <div className="h-3 bg-zinc-800 rounded w-3/4 animate-pulse" />
        </div>
        <div className="h-2 bg-zinc-800 rounded-full w-full animate-pulse" />
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 bg-zinc-800/50 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

type RiskProfile = "conservative" | "balanced" | "aggressive";

const RISK_PROFILES: { id: RiskProfile; label: string; description: string; icon: string }[] = [
  {
    id: "conservative",
    label: "Conservative",
    description: "Stablecoins & low-risk lending. Prioritize capital preservation.",
    icon: "🛡",
  },
  {
    id: "balanced",
    label: "Balanced",
    description: "Mix of stable and growth pools. Best risk-adjusted returns.",
    icon: "⚖",
  },
  {
    id: "aggressive",
    label: "Aggressive",
    description: "High-yield pools including governance tokens. Maximum returns.",
    icon: "🔥",
  },
];

export default function StrategyPage() {
  const { address, isConnected } = useAccount();
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [loading, setLoading] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [selectedRisk, setSelectedRisk] = useState<RiskProfile>("balanced");

  useEffect(() => {
    if (!isConnected) {
      setStrategy(null);
      setLoading(false);
    }
  }, [isConnected]);

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    fetch(`/api/strategy?address=${address}`)
      .then((res) => res.json())
      .then((data) => setStrategy(data.strategy))
      .catch(() => {
        setStrategy(null);
      })
      .finally(() => setLoading(false));
  }, [address]);

  const handleTrigger = async (profile?: RiskProfile) => {
    if (!address) return;
    const risk = profile || selectedRisk;
    setSelectedRisk(risk);
    setTriggering(true);
    try {
      const res = await fetch("/api/strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "trigger", userAddress: address, riskProfile: risk }),
      });
      const data = await res.json();
      if (data.strategy) setStrategy(data.strategy);
    } catch (error) {
      console.error("Failed to trigger analysis:", error);
    } finally {
      setTriggering(false);
    }
  };

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
        <p className="text-zinc-500 text-sm max-w-sm text-center">Connect your wallet to receive AI-powered yield optimization proposals.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-50 mb-1">Strategy</h1>
          <p className="text-sm text-zinc-400">AI-powered yield optimization proposals for your portfolio.</p>
        </div>
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-50 mb-1">Strategy</h1>
          <p className="text-sm text-zinc-400">
            AI-powered yield optimization proposals for your portfolio.
          </p>
        </div>
        <button
          onClick={() => handleTrigger()}
          disabled={triggering}
          className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 font-medium py-2.5 px-5 rounded-lg transition-colors duration-150 disabled:opacity-50 text-sm flex items-center gap-2"
        >
          {triggering ? (
            <>
              <span className="animate-spin h-4 w-4 border-2 border-zinc-500 border-t-zinc-200 rounded-full" />
              Analyzing...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M8 1L10 5.5H15L11 8.5L12.5 13.5L8 10.5L3.5 13.5L5 8.5L1 5.5H6L8 1Z" stroke="currentColor" strokeWidth="1.2" fill="none" />
              </svg>
              Analyze Now
            </>
          )}
        </button>
      </div>

      {/* Risk Profile Selector */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <p className="text-xs text-zinc-500 uppercase tracking-wide mb-3">Risk Profile</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {RISK_PROFILES.map((profile) => (
            <button
              key={profile.id}
              onClick={() => {
                setSelectedRisk(profile.id);
                handleTrigger(profile.id);
              }}
              disabled={triggering}
              className={`text-left p-3 rounded-lg border transition-colors duration-150 disabled:opacity-50 ${
                selectedRisk === profile.id
                  ? "border-green-500/40 bg-green-500/5"
                  : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-600"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm" aria-hidden="true">{profile.icon}</span>
                <span className={`text-sm font-medium ${selectedRisk === profile.id ? "text-green-400" : "text-zinc-300"}`}>
                  {profile.label}
                </span>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">{profile.description}</p>
            </button>
          ))}
        </div>
      </div>

      <StrategyProposal strategy={strategy} />
    </div>
  );
}
