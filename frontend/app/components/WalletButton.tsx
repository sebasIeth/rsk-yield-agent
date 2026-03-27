"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

export function WalletButton() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        return (
          <div
            {...(!ready && {
              "aria-hidden": true,
              style: {
                opacity: 0,
                pointerEvents: "none" as const,
                userSelect: "none" as const,
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <button
                    onClick={openConnectModal}
                    className="bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-5 rounded-lg transition-colors duration-150 active:scale-[0.98] text-sm"
                  >
                    Connect
                  </button>
                );
              }

              if (chain.unsupported) {
                return (
                  <button
                    onClick={openChainModal}
                    className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 font-medium py-2 px-4 rounded-lg transition-colors duration-150 hover:bg-red-500/20 text-sm"
                  >
                    <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                    Wrong network
                  </button>
                );
              }

              return (
                <div className="flex items-center gap-2">
                  <button
                    onClick={openChainModal}
                    className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-white py-2 px-3 rounded-lg transition-colors duration-150 text-sm"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    <span className="hidden sm:inline text-zinc-400">{chain.name}</span>
                    {(chain as typeof chain & { testnet?: boolean }).testnet && (
                      <span className="text-[10px] font-medium text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">
                        TEST
                      </span>
                    )}
                  </button>
                  <button
                    onClick={openAccountModal}
                    className="flex items-center gap-2.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-white py-2 px-3 rounded-lg transition-colors duration-150 text-sm"
                  >
                    {account.displayBalance && (
                      <span className="font-medium text-zinc-50">
                        {account.displayBalance}
                      </span>
                    )}
                    <span className="text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded text-xs font-mono">
                      {account.displayName}
                    </span>
                  </button>
                </div>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
