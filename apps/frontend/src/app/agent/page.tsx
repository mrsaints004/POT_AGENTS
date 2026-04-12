"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface AgentProfile {
  tasksCompleted: number;
  tasksFailed: number;
  tasksTotal: number;
  successRate: number;
  totalEarned: number;
  onChainAttestations: number;
  recentAttestations: {
    id: string;
    taskId: string;
    taskType: string;
    providerUsed: string;
    costUsd: number;
    txHash: string | null;
    createdAt: string;
  }[];
}

interface AgentStatus {
  agentAddress: string;
  contractAddress: string | null;
  chain: {
    name: string;
    chainId: number;
    explorerUrl: string;
  };
}

export default function AgentPage() {
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getAgentProfile(), api.getAgentStatus()])
      .then(([p, s]) => {
        setProfile(p);
        setStatus(s);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-gray-500 text-center py-20">Loading agent profile...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Agent Profile</h1>
        <p className="text-gray-500 text-sm">On-chain track record and performance metrics</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Tasks Completed" value={profile?.tasksCompleted ?? 0} color="text-green-400" />
        <StatCard
          label="Success Rate"
          value={`${profile?.successRate ?? 0}%`}
          color="text-kite-400"
        />
        <StatCard
          label="Total Earned"
          value={`$${(profile?.totalEarned ?? 0).toFixed(6)}`}
          color="text-emerald-400"
        />
        <StatCard
          label="On-Chain Attestations"
          value={profile?.onChainAttestations ?? 0}
          color="text-cyan-400"
        />
      </div>

      {/* Agent Info */}
      {status && (
        <div className="border border-gray-800 rounded-lg p-5 bg-gray-900/50 space-y-3">
          <h2 className="text-lg font-semibold text-white mb-3">Agent Details</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Agent Address</span>
              {status.agentAddress && status.agentAddress !== "Not yet active" ? (
                <a
                  href={`${status.chain.explorerUrl}/address/${status.agentAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-kite-400 hover:text-kite-300 font-mono text-xs"
                >
                  {status.agentAddress}
                </a>
              ) : (
                <span className="text-gray-500 text-xs">{status.agentAddress}</span>
              )}
            </div>
            {status.contractAddress && (
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Contract Address</span>
                <a
                  href={`${status.chain.explorerUrl}/address/${status.contractAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-kite-400 hover:text-kite-300 font-mono text-xs"
                >
                  {status.contractAddress}
                </a>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Network</span>
              <span className="text-gray-300 text-xs">
                {status.chain.name} (Chain ID: {status.chain.chainId})
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Recent Attestations */}
      {profile && profile.recentAttestations.length > 0 && (
        <div className="border border-gray-800 rounded-lg p-5 bg-gray-900/50">
          <h2 className="text-lg font-semibold text-white mb-4">Recent Attestations</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800">
                  <th className="text-left py-2 pr-4 font-medium">Type</th>
                  <th className="text-left py-2 pr-4 font-medium">Provider</th>
                  <th className="text-left py-2 pr-4 font-medium">Cost</th>
                  <th className="text-left py-2 pr-4 font-medium">Tx</th>
                  <th className="text-left py-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {profile.recentAttestations.map((a) => (
                  <tr key={a.id} className="border-b border-gray-800/50">
                    <td className="py-2 pr-4 text-gray-300">{a.taskType}</td>
                    <td className="py-2 pr-4 text-gray-400">{a.providerUsed}</td>
                    <td className="py-2 pr-4 text-gray-400">${a.costUsd.toFixed(6)}</td>
                    <td className="py-2 pr-4">
                      {a.txHash ? (
                        <a
                          href={`https://testnet.kitescan.ai/tx/${a.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-kite-400 hover:text-kite-300 font-mono text-xs"
                        >
                          {a.txHash.substring(0, 10)}...
                        </a>
                      ) : (
                        <span className="text-gray-600 text-xs">off-chain</span>
                      )}
                    </td>
                    <td className="py-2 text-gray-500 text-xs">
                      {new Date(a.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
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
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
