"use client";

import { useState, useEffect } from "react";
import { useAccount, useBalance, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { parseEther, formatEther } from "viem";

const VAULT_ADDRESS = process.env.NEXT_PUBLIC_VAULT_ADDRESS as `0x${string}` | undefined;
const RBTC_PRICE = parseFloat(process.env.NEXT_PUBLIC_RBTC_PRICE_USD || "95000");
const EXPLORER_URL = "https://explorer.testnet.rsk.co";

const VAULT_ABI = [
  {
    name: "deposit",
    type: "function",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    name: "balances",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

type TxStatus = "idle" | "pending" | "confirming" | "success" | "error";

export function VaultCard() {
  const { address, isConnected } = useAccount();
  const { data: balance, refetch: refetchBalance } = useBalance({ address });
  const { data: vaultBalanceRaw, refetch: refetchVault } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: "balances",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!VAULT_ADDRESS },
  });
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [txNotification, setTxNotification] = useState<{ status: TxStatus; hash?: string; type: "deposit" | "withdraw" } | null>(null);

  const { writeContract: deposit, data: depositHash, error: depositTxError, isPending: isDepositPending } = useWriteContract();
  const { writeContract: withdraw, data: withdrawHash, error: withdrawTxError, isPending: isWithdrawPending } = useWriteContract();

  const { isLoading: isDepositConfirming, isSuccess: isDepositSuccess } = useWaitForTransactionReceipt({ hash: depositHash });
  const { isLoading: isWithdrawConfirming, isSuccess: isWithdrawSuccess } = useWaitForTransactionReceipt({ hash: withdrawHash });

  // Track deposit tx lifecycle
  useEffect(() => {
    if (isDepositPending) setTxNotification({ status: "pending", type: "deposit" });
  }, [isDepositPending]);
  useEffect(() => {
    if (depositHash && isDepositConfirming) setTxNotification({ status: "confirming", hash: depositHash, type: "deposit" });
  }, [depositHash, isDepositConfirming]);
  useEffect(() => {
    if (isDepositSuccess && depositHash) {
      setTxNotification({ status: "success", hash: depositHash, type: "deposit" });
      setDepositAmount("");
      setShowDeposit(false);
      refetchBalance(); refetchVault();
    }
  }, [isDepositSuccess, depositHash, refetchBalance]);
  useEffect(() => {
    if (depositTxError) {
      console.error("[Deposit Error]", depositTxError);
      const msg = depositTxError.message || String(depositTxError);
      if (msg.includes("User rejected") || msg.includes("user rejected")) {
        setDepositError("Transaction rejected");
      } else {
        setDepositError(msg.length > 200 ? msg.slice(0, 200) + "..." : msg);
      }
      setTxNotification(null);
    }
  }, [depositTxError]);

  // Track withdraw tx lifecycle
  useEffect(() => {
    if (isWithdrawPending) setTxNotification({ status: "pending", type: "withdraw" });
  }, [isWithdrawPending]);
  useEffect(() => {
    if (withdrawHash && isWithdrawConfirming) setTxNotification({ status: "confirming", hash: withdrawHash, type: "withdraw" });
  }, [withdrawHash, isWithdrawConfirming]);
  useEffect(() => {
    if (isWithdrawSuccess && withdrawHash) {
      setTxNotification({ status: "success", hash: withdrawHash, type: "withdraw" });
      setWithdrawAmount("");
      setShowWithdraw(false);
      refetchBalance(); refetchVault();
    }
  }, [isWithdrawSuccess, withdrawHash, refetchBalance]);
  useEffect(() => {
    if (withdrawTxError) {
      console.error("[Withdraw Error]", withdrawTxError);
      const msg = withdrawTxError.message || String(withdrawTxError);
      if (msg.includes("User rejected") || msg.includes("user rejected")) {
        setWithdrawError("Transaction rejected");
      } else {
        setWithdrawError(msg.length > 200 ? msg.slice(0, 200) + "..." : msg);
      }
      setTxNotification(null);
    }
  }, [withdrawTxError]);

  const walletBalance = balance ? parseFloat(formatEther(balance.value)) : 0;
  const usdValue = walletBalance * RBTC_PRICE;

  const depositValid = depositAmount && parseFloat(depositAmount) > 0 && parseFloat(depositAmount) <= walletBalance;
  const withdrawValid = withdrawAmount && parseFloat(withdrawAmount) > 0;

  const isDepositing = isDepositPending || isDepositConfirming;
  const isWithdrawing = isWithdrawPending || isWithdrawConfirming;

  const vaultBalance = vaultBalanceRaw ? parseFloat(formatEther(vaultBalanceRaw as bigint)) : 0;
  const vaultUsd = vaultBalance * RBTC_PRICE;

  const handleDeposit = () => {
    if (!VAULT_ADDRESS || !depositAmount) return;
    setDepositError(null);
    deposit({
      address: VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: "deposit",
      value: parseEther(depositAmount),
      gasPrice: BigInt(60000000),
    });
  };

  const handleWithdraw = () => {
    if (!VAULT_ADDRESS || !withdrawAmount) return;
    setWithdrawError(null);
    withdraw({
      address: VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: "withdraw",
      args: [parseEther(withdrawAmount)],
      gasPrice: BigInt(60000000),
    });
  };

  if (!isConnected) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M9 2L15 5.5V12.5L9 16L3 12.5V5.5L9 2Z" stroke="#22C55E" strokeWidth="1.5" fill="none"/>
            </svg>
          </div>
          <div>
            <h2 className="text-base font-semibold text-zinc-50">Your Vault</h2>
            <p className="text-xs text-zinc-500">Smart yield aggregation</p>
          </div>
        </div>
        <p className="text-zinc-400 text-sm">Connect your wallet to view your vault balance and start earning yield.</p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-green-500 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M9 2L15 5.5V12.5L9 16L3 12.5V5.5L9 2Z" stroke="white" strokeWidth="1.5" fill="none"/>
            </svg>
          </div>
          <div>
            <h2 className="text-base font-semibold text-zinc-50">Your Vault</h2>
            <p className="text-xs text-zinc-500">Smart yield aggregation</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-60" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
          </span>
          <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Active</span>
        </div>
      </div>

      {/* Vault Balance */}
      <div className="mb-4 p-4 rounded-lg bg-zinc-800 border border-zinc-700">
        <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Deposited in Vault</p>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold text-green-500 font-mono tabular-nums">
            {vaultBalance.toFixed(6)}
          </span>
          <span className="text-sm text-zinc-500">tRBTC</span>
        </div>
        <p className="text-xs text-zinc-500 mt-0.5">
          ${vaultUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })} USD
        </p>
      </div>

      {/* Wallet Balance */}
      <div className="mb-6">
        <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Wallet Balance</p>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-semibold text-zinc-50 font-mono tabular-nums">
            {walletBalance.toFixed(6)}
          </span>
          <span className="text-sm text-zinc-500">tRBTC</span>
        </div>
        <p className="text-xs text-zinc-500 mt-0.5">
          ${usdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} USD
        </p>
      </div>

      {/* APY indicator */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800 mb-6">
        <div className="flex-1">
          <p className="text-xs text-zinc-500">Current APY</p>
          <p className="text-xl font-semibold text-green-500 font-mono">5.4%</p>
        </div>
        <span className="text-xs text-zinc-500">Weighted avg</span>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => { setShowDeposit(!showDeposit); setShowWithdraw(false); }}
          className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-150 active:scale-[0.98] text-sm"
        >
          <span className="flex items-center justify-center gap-2">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Deposit
          </span>
        </button>
        <button
          onClick={() => { setShowWithdraw(!showWithdraw); setShowDeposit(false); }}
          className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold py-3 px-4 rounded-lg transition-colors duration-150 active:scale-[0.98] text-sm"
        >
          <span className="flex items-center justify-center gap-2">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Withdraw
          </span>
        </button>
      </div>

      {/* Deposit Panel */}
      <div className={`transition-all duration-200 overflow-hidden ${showDeposit ? "max-h-60 opacity-100 mt-4" : "max-h-0 opacity-0"}`}>
        <div className="p-4 rounded-lg bg-zinc-800 border border-zinc-700">
          <label htmlFor="deposit-amount" className="block text-xs text-zinc-500 uppercase tracking-wide mb-2">Deposit Amount (tRBTC)</label>
          <div className="relative mb-3">
            <input
              id="deposit-amount"
              type="number"
              step="0.001"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="0.01"
              aria-describedby={depositError ? "deposit-error" : undefined}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-zinc-50 text-lg font-mono focus:ring-2 focus:ring-green-500/50 focus:border-green-500 focus:outline-none transition-colors duration-150 placeholder:text-zinc-600"
            />
            <button
              onClick={() => setDepositAmount(walletBalance.toFixed(6))}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-green-500 hover:text-green-400 uppercase tracking-wider bg-green-500/10 px-2 py-1 rounded min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors duration-150"
            >
              Max
            </button>
          </div>
          {depositAmount && parseFloat(depositAmount) > walletBalance && (
            <p className="text-xs text-red-500 mt-1 mb-2">Exceeds balance of {walletBalance.toFixed(6)} tRBTC</p>
          )}
          <button
            onClick={handleDeposit}
            disabled={isDepositing || !depositValid}
            className="w-full bg-green-500 hover:bg-green-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-semibold py-3 rounded-lg transition-colors duration-150 text-sm min-h-[44px]"
          >
            {isDepositing ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                Confirming...
              </span>
            ) : (
              "Confirm Deposit"
            )}
          </button>
          {depositError && (
            <p id="deposit-error" className="text-xs text-red-500 mt-2" role="alert">{depositError}</p>
          )}
        </div>
      </div>

      {/* Withdraw Panel */}
      <div className={`transition-all duration-200 overflow-hidden ${showWithdraw ? "max-h-60 opacity-100 mt-4" : "max-h-0 opacity-0"}`}>
        <div className="p-4 rounded-lg bg-zinc-800 border border-zinc-700">
          <label htmlFor="withdraw-amount" className="block text-xs text-zinc-500 uppercase tracking-wide mb-2">Withdraw Amount (tRBTC)</label>
          <div className="relative mb-3">
            <input
              id="withdraw-amount"
              type="number"
              step="0.001"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="0.01"
              aria-describedby={withdrawError ? "withdraw-error" : undefined}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-zinc-50 text-base sm:text-lg font-mono focus:ring-2 focus:ring-red-500/50 focus:border-red-500 focus:outline-none transition-colors duration-150 placeholder:text-zinc-600"
            />
          </div>
          <button
            onClick={handleWithdraw}
            disabled={isWithdrawing || !withdrawValid}
            className="w-full bg-red-500 hover:bg-red-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-semibold py-3 rounded-lg transition-colors duration-150 text-sm min-h-[44px]"
          >
            {isWithdrawing ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                Confirming...
              </span>
            ) : (
              "Confirm Withdrawal"
            )}
          </button>
          {withdrawError && (
            <p id="withdraw-error" className="text-xs text-red-500 mt-2" role="alert">{withdrawError}</p>
          )}
        </div>
      </div>

      {/* Transaction Notification */}
      {txNotification && (
        <div className="mt-4" role="alert" aria-live="polite">
          {txNotification.status === "pending" && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <span className="animate-spin h-4 w-4 border-2 border-amber-400 border-t-transparent rounded-full flex-shrink-0" />
              <p className="text-sm text-amber-400">Confirm in your wallet...</p>
            </div>
          )}
          {txNotification.status === "confirming" && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <span className="animate-spin h-4 w-4 border-2 border-blue-400 border-t-transparent rounded-full flex-shrink-0" />
              <div>
                <p className="text-sm text-blue-400">Waiting for confirmation...</p>
                {txNotification.hash && (
                  <a
                    href={`${EXPLORER_URL}/tx/${txNotification.hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400/70 hover:text-blue-300 font-mono"
                  >
                    {txNotification.hash.slice(0, 14)}...{txNotification.hash.slice(-8)}
                  </a>
                )}
              </div>
            </div>
          )}
          {txNotification.status === "success" && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="flex items-center gap-3">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M3 8.5L6.5 12L13 4" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div>
                  <p className="text-sm text-green-400">
                    {txNotification.type === "deposit" ? "Deposit" : "Withdrawal"} confirmed
                  </p>
                  {txNotification.hash && (
                    <a
                      href={`${EXPLORER_URL}/tx/${txNotification.hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-green-400/70 hover:text-green-300 font-mono"
                    >
                      View on explorer
                    </a>
                  )}
                </div>
              </div>
              <button
                onClick={() => setTxNotification(null)}
                className="text-zinc-500 hover:text-zinc-300 p-1"
                aria-label="Dismiss notification"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
