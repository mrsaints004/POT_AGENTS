"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface StatusData {
  status: string;
  agent: {
    address: string;
    kiteBalance: string;
    usdtBalance: string;
  };
  uptime: {
    ms: number;
    display: string;
  };
  tasks: {
    total: number;
    completed: number;
    failed: number;
    processing: number;
    successRate: number;
  };
  settlement: {
    totalUsdSettled: number;
    onChainAttestations: number;
  };
  lastAttestation: {
    timestamp: string;
    txHash: string | null;
    explorerUrl: string | null;
  } | null;
  chain: {
    name: string;
    chainId: number;
    rpcUrl: string;
    explorerUrl: string;
  };
}

export default function StatusPage() {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchStatus = () => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/status`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLastRefresh(new Date());
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30_000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="text-gray-500 text-center py-20">Loading status...</div>;
  }

  if (!data) {
    return <div className="text-red-400 text-center py-20">Failed to load status</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Live Status</h1>
          <p className="text-gray-500 text-sm">
            Production monitoring — auto-refreshes every 30s
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full animate-pulse ${
                data.status === "operational" ? "bg-green-400" : "bg-red-400"
              }`}
            />
            <span
              className={`text-sm font-medium ${
                data.status === "operational" ? "text-green-400" : "text-red-400"
              }`}
            >
              {data.status === "operational" ? "Operational" : "Degraded"}
            </span>
          </span>
        </div>
      </div>

      {/* Uptime + Agent Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border border-green-500/30 rounded-lg p-4 bg-green-500/5">
          <div className="text-2xl font-bold text-green-400">{data.uptime.display}</div>
          <div className="text-xs text-gray-500 mt-1">Uptime</div>
        </div>
        <div className="border border-kite-500/30 rounded-lg p-4 bg-kite-500/5">
          <div className="text-lg font-bold text-kite-400 font-mono truncate">
            {data.agent.address !== "Not configured"
              ? `${data.agent.address.substring(0, 6)}...${data.agent.address.slice(-4)}`
              : "Not configured"}
          </div>
          <div className="text-xs text-gray-500 mt-1">Agent Address</div>
        </div>
        <div className="border border-gray-800 rounded-lg p-4 bg-gray-900/50">
          <div className="text-lg font-bold text-white">
            {data.chain.name}
          </div>
          <div className="text-xs text-gray-500 mt-1">Chain ID: {data.chain.chainId}</div>
        </div>
      </div>

      {/* Task Metrics */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3">Task Metrics</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <MetricCard label="Total Tasks" value={data.tasks.total} color="text-white" />
          <MetricCard label="Completed" value={data.tasks.completed} color="text-green-400" />
          <MetricCard label="Failed" value={data.tasks.failed} color="text-red-400" />
          <MetricCard label="Processing" value={data.tasks.processing} color="text-yellow-400" />
          <MetricCard label="Success Rate" value={`${data.tasks.successRate}%`} color="text-kite-400" />
        </div>
      </div>

      {/* Settlement */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3">On-Chain Settlement</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            label="Total Settled"
            value={`$${data.settlement.totalUsdSettled.toFixed(4)}`}
            color="text-emerald-400"
          />
          <MetricCard
            label="On-Chain Attestations"
            value={data.settlement.onChainAttestations}
            color="text-cyan-400"
          />
          <MetricCard
            label="KITE Balance"
            value={`${parseFloat(data.agent.kiteBalance).toFixed(2)}`}
            color="text-purple-400"
          />
          <MetricCard
            label="USDT Balance"
            value={`$${parseFloat(data.agent.usdtBalance).toFixed(2)}`}
            color="text-emerald-400"
          />
        </div>
      </div>

      {/* Last Attestation */}
      {data.lastAttestation && (
        <div className="border border-gray-800 rounded-lg p-5 bg-gray-900/50">
          <h2 className="text-lg font-semibold text-white mb-3">Last Attestation</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Timestamp</span>
              <span className="text-gray-300">
                {new Date(data.lastAttestation.timestamp).toLocaleString()}
              </span>
            </div>
            {data.lastAttestation.txHash && (
              <div className="flex justify-between">
                <span className="text-gray-500">Transaction</span>
                <a
                  href={data.lastAttestation.explorerUrl ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-kite-400 hover:text-kite-300 font-mono text-xs"
                >
                  {data.lastAttestation.txHash.substring(0, 16)}...
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-xs text-gray-600 text-center">
        Last refreshed: {lastRefresh.toLocaleTimeString()} | Auto-refreshes every 30s
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="border border-gray-800 rounded-lg p-4 bg-gray-900/50">
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}
