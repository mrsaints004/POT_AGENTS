"use client";

import { useState, useEffect } from "react";
import { useAccount, useConnect, useDisconnect, useReconnect, useSwitchChain, useChainId } from "wagmi";
import { kiteTestnet } from "@/lib/wagmi";

export function ConnectWallet() {
  const { address, isConnected } = useAccount();
  const { connectors, connect, error: connectError, reset } = useConnect();
  const { disconnect } = useDisconnect();
  const { reconnect } = useReconnect();
  const { switchChain } = useSwitchChain();
  const chainId = useChainId();

  // Prevent hydration mismatch — only render wallet UI after mount
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const isWrongNetwork = isConnected && chainId !== kiteTestnet.id;

  if (isConnected && isWrongNetwork) {
    return (
      <button
        onClick={() => switchChain({ chainId: kiteTestnet.id })}
        className="px-3 py-1.5 rounded-lg border border-red-500/50 bg-red-500/10 text-red-400 text-sm hover:bg-red-500/20 transition animate-pulse"
      >
        Switch to Kite Testnet
      </button>
    );
  }

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-emerald-400">Kite Testnet</span>
        <span className="text-sm text-kite-400 font-mono">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        <button
          onClick={() => disconnect()}
          className="text-xs text-gray-500 hover:text-gray-300 transition"
        >
          Disconnect
        </button>
      </div>
    );
  }

  // Find the injected (MetaMask) connector specifically
  const injectedConnector = connectors.find(
    (c) => c.type === "injected" || c.id === "injected" || c.name === "MetaMask"
  );

  const handleConnect = async () => {
    const connector = injectedConnector || connectors[0];
    if (!connector) return;

    // If there's a stale "already connected" error, disconnect first then reconnect
    if (connectError?.message?.includes("already connected")) {
      reset();
      disconnect();
      // Small delay to let wagmi clear state
      await new Promise((r) => setTimeout(r, 100));
    }

    try {
      connect({ connector, chainId: kiteTestnet.id });
    } catch {
      // If connect throws "already connected", force disconnect and retry
      disconnect();
      await new Promise((r) => setTimeout(r, 100));
      connect({ connector, chainId: kiteTestnet.id });
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleConnect}
        className="px-3 py-1.5 rounded-lg border border-kite-500/50 bg-kite-500/10 text-kite-400 text-sm hover:bg-kite-500/20 transition"
      >
        Connect Wallet
      </button>
      {connectError && !connectError.message?.includes("already connected") && (
        <span className="text-xs text-red-400 max-w-[200px] truncate" title={connectError.message}>
          {connectError.message.split("\n")[0]}
        </span>
      )}
    </div>
  );
}
