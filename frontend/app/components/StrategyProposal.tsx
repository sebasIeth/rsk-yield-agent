"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import type { Strategy } from "@/app/types";

function sanitizeText(text: string): string {
  return text.replace(/<[^>]*>/g, '').slice(0, 1000);
}

const ALLOC_COLORS = [
  { bg: "bg-green-500", text: "text-green-500" },
  { bg: "bg-blue-500", text: "text-blue-400" },
  { bg: "bg-amber-500", text: "text-amber-500" },
  { bg: "bg-purple-500", text: "text-purple-400" },
  { bg: "bg-rose-500", text: "text-rose-400" },
];

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = confidence * 100;
  const color = pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-amber-500" : "bg-red-500";
  const textColor = pct >= 80 ? "text-green-500" : pct >= 60 ? "text-amber-500" : "text-red-500";

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className={`h-full rounded-full ${color} transition-all duration-300`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <span className={`text-sm font-mono font-semibold ${textColor}`}>{pct.toFixed(0)}%</span>
    </div>
  );
}

export function StrategyProposal({ strategy }: { strategy: Strategy | null }) {
  const { address } = useAccount();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(strategy?.status || "pending");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!strategy) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-10 text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-zinc-800 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="7" stroke="#71717A" strokeWidth="1.5" fill="none" />
            <path d="M16 16L21 21" stroke="#71717A" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-zinc-50 mb-2">No pending strategies</h3>
        <p className="text-zinc-500 text-sm max-w-sm mx-auto">
          The AI agent is monitoring DeFi protocols on Rootstock. New optimization proposals will appear here.
        </p>
      </div>
    );
  }

  const currentApy = strategy.currentApy ?? 0;
  const estimatedApy = strategy.estimatedApy ?? 0;
  const confidence = strategy.confidence ?? 0;
  const apyDelta = estimatedApy - currentApy;

  const handleApprove = async () => {
    if (!address) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve",
          strategyId: strategy.id,
          userAddress: address,
        }),
      });
      const data = await res.json();
      if (data.success && data.txHash) {
        setStatus("executed");
        setTxHash(data.txHash);
        setShowSuccess(true);
      } else if (data.success && data.status === "approved") {
        setStatus("approved");
        setError(data.note || "Approved — awaiting execution.");
      } else {
        setError(data.error || "Execution failed. Please try again.");
      }
    } catch (err) {
      setError("Failed to execute strategy. Please try again.");
      console.error("Failed to approve strategy:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!address) return;
    setError(null);
    setLoading(true);
    try {
      await fetch("/api/strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject",
          strategyId: strategy.id,
          userAddress: address,
        }),
      });
      setStatus("rejected");
    } catch (err) {
      setError("Failed to reject strategy. Please try again.");
      console.error("Failed to reject strategy:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 relative">
      {/* Success banner */}
      {showSuccess && (
        <div className="mb-6 p-4 rounded-lg bg-green-500/10 border border-green-500/20" role="alert" aria-live="polite">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M4 8L7 11L12 5" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-sm font-medium text-green-500">Strategy executed successfully</span>
            </div>
            <button
              onClick={() => setShowSuccess(false)}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors duration-150"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-semibold text-zinc-50">AI Strategy Proposal</h2>
          <p className="text-xs text-zinc-500">Powered by yield optimization agent</p>
        </div>
        <span
          className={`px-2.5 py-1 rounded text-[10px] font-medium uppercase tracking-wider ${
            status === "pending"
              ? "bg-amber-500/10 text-amber-500"
              : status === "executed"
              ? "bg-green-500/10 text-green-500"
              : "bg-zinc-800 text-zinc-500"
          }`}
        >
          {status}
        </span>
      </div>

      {/* APY Comparison */}
      <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6 mb-6 p-5 rounded-lg bg-zinc-800/50">
        <div className="flex-1 text-center">
          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Current APY</p>
          <p className="text-3xl font-semibold text-zinc-50 font-mono">{currentApy.toFixed(1)}<span className="text-lg text-zinc-500">%</span></p>
        </div>

        <div className="flex flex-col items-center gap-1 px-4">
          <div className={`text-xs font-medium px-2 py-0.5 rounded ${apyDelta > 0 ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
            {apyDelta > 0 ? "+" : ""}{apyDelta.toFixed(1)}%
          </div>
          <svg width="32" height="12" viewBox="0 0 32 12" fill="none" className="text-zinc-600" aria-hidden="true">
            <path d="M2 6H24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M20 2L26 6L20 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <div className="flex-1 text-center">
          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Proposed APY</p>
          <p className="text-3xl font-semibold text-green-500 font-mono">{estimatedApy.toFixed(1)}<span className="text-lg">%</span></p>
        </div>
      </div>

      {/* Confidence */}
      <div className="mb-6">
        <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Confidence</p>
        <ConfidenceBar confidence={confidence} />
      </div>

      {/* Reason */}
      <div className="mb-6 p-4 rounded-lg bg-zinc-800/50">
        <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Agent Reasoning</p>
        <p className="text-sm text-zinc-300 leading-relaxed">{sanitizeText(strategy.reason)}</p>
      </div>

      {/* Allocation */}
      <div className="mb-6">
        <p className="text-xs text-zinc-500 uppercase tracking-wide mb-3">Proposed Allocation</p>
        <div className="space-y-2">
          {strategy.allocationsJson.map((a, i) => {
            const color = ALLOC_COLORS[i % ALLOC_COLORS.length];
            return (
              <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-zinc-800/50">
                <div className="flex items-center gap-2.5">
                  <span className={`w-1.5 h-6 rounded-full ${color.bg}`} />
                  <div>
                    <span className="text-sm text-zinc-50 font-medium capitalize">{a.protocol}</span>
                    <span className="text-xs text-zinc-500 ml-2 font-mono">{a.asset}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`text-xs font-mono ${color.text}`}>{a.apy.toFixed(1)}% APY</span>
                  <span className="text-sm font-semibold text-zinc-50 font-mono w-12 text-right">{a.percent}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg" role="alert">
          <p className="text-sm text-red-500">{error}</p>
          <button onClick={() => setError(null)} className="text-xs text-red-500/70 mt-1 underline transition-colors duration-150">Dismiss</button>
        </div>
      )}

      {/* Actions */}
      {status === "pending" && (
        <div className="flex gap-3">
          <button
            onClick={handleApprove}
            disabled={loading}
            className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-semibold py-3.5 rounded-lg transition-colors duration-150 active:scale-[0.98]"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                Executing...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2 text-sm">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M4 8L7 11L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Approve &amp; Execute
              </span>
            )}
          </button>
          <button
            onClick={handleReject}
            disabled={loading}
            className="flex-1 text-zinc-400 border border-zinc-700 hover:bg-zinc-800/50 hover:text-zinc-200 font-semibold py-3.5 rounded-lg transition-colors duration-150 disabled:opacity-40 active:scale-[0.98] text-sm"
          >
            Reject
          </button>
        </div>
      )}

      {txHash && (
        <div className="mt-4 p-3.5 rounded-lg bg-green-500/5 border border-green-500/20">
          <p className="text-sm text-green-500 flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M3 7L6 10L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Transaction confirmed:{" "}
            <a
              href={`https://explorer.testnet.rsk.co/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-green-400 font-mono text-xs transition-colors duration-150"
            >
              {txHash.slice(0, 10)}...{txHash.slice(-8)}
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
