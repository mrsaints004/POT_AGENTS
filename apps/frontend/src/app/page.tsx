"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { AttestationCard } from "@/components/AttestationCard";

const STATUS_COLORS: Record<string, string> = {
  pending: "text-yellow-400 bg-yellow-500/10",
  processing: "text-blue-400 bg-blue-500/10",
  "selecting-provider": "text-purple-400 bg-purple-500/10",
  executing: "text-orange-400 bg-orange-500/10",
  "recording-attestation": "text-cyan-400 bg-cyan-500/10",
  completed: "text-green-400 bg-green-500/10",
  failed: "text-red-400 bg-red-500/10",
};

export default function Dashboard() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [attestations, setAttestations] = useState<any[]>([]);
  const [taskStats, setTaskStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getTasks(), api.getAttestations(), api.getTaskStats()])
      .then(([t, a, s]) => {
        setTasks(t);
        setAttestations(a);
        setTaskStats(s);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const stats = {
    total: tasks.length,
    completed: tasks.filter((t) => t.status === "completed").length,
    attestations: attestations.length,
    onChain: attestations.filter((a: any) => a.txHash).length,
  };

  if (loading) {
    return <div className="text-gray-500 text-center py-20">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Dashboard</h1>
        <p className="text-gray-500">Autonomous Freelancer Agent with Proof of Thought</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Tasks", value: stats.total },
          { label: "Completed", value: stats.completed },
          { label: "Attestations", value: stats.attestations },
          { label: "On-Chain", value: stats.onChain },
        ].map((s) => (
          <div key={s.label} className="border border-gray-800 rounded-lg p-4 bg-gray-900/50">
            <div className="text-2xl font-bold text-white">{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Comparison & Analytics Stats */}
      {taskStats && (taskStats.totalComparisons > 0 || true) && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="border border-purple-500/30 rounded-lg p-4 bg-purple-500/5">
            <div className="text-2xl font-bold text-purple-400">{taskStats.comparisonsRun ?? 0}</div>
            <div className="text-xs text-gray-500 mt-1">Comparisons Run</div>
          </div>
          <div className="border border-emerald-500/30 rounded-lg p-4 bg-emerald-500/5">
            <div className="text-2xl font-bold text-emerald-400">
              ${(taskStats.totalSaved ?? 0).toFixed(4)}
            </div>
            <div className="text-xs text-gray-500 mt-1">Total Saved</div>
          </div>
          <div className="border border-cyan-500/30 rounded-lg p-4 bg-cyan-500/5">
            <div className="text-2xl font-bold text-cyan-400">{taskStats.avgCostSavings ?? 0}%</div>
            <div className="text-xs text-gray-500 mt-1">Avg Savings %</div>
          </div>
          <div className="border border-kite-500/30 rounded-lg p-4 bg-kite-500/5">
            <div className="text-2xl font-bold text-kite-400">x402</div>
            <div className="text-xs text-gray-500 mt-1">Payment Protocol</div>
          </div>
        </div>
      )}

      {/* Recent Tasks */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Recent Tasks</h2>
          <Link href="/tasks/new" className="text-sm text-kite-400 hover:text-kite-300">
            + New Task
          </Link>
        </div>
        {tasks.length === 0 ? (
          <div className="text-gray-600 text-sm border border-gray-800 rounded-lg p-8 text-center">
            No tasks yet.{" "}
            <Link href="/tasks/new" className="text-kite-400 hover:underline">
              Create one
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.slice(0, 5).map((task) => (
              <Link
                key={task.id}
                href={`/tasks/${task.id}`}
                className="flex items-center justify-between border border-gray-800 rounded-lg p-4 bg-gray-900/50 hover:border-gray-700 transition"
              >
                <div>
                  <span className="text-sm text-gray-300">
                    {task.type} — {task.input?.substring(0, 60)}
                    {task.input?.length > 60 ? "..." : ""}
                  </span>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[task.status] || "text-gray-400"}`}
                >
                  {task.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Recent Attestations */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Recent Attestations</h2>
          <Link href="/attestations" className="text-sm text-kite-400 hover:text-kite-300">
            View All
          </Link>
        </div>
        {attestations.length === 0 ? (
          <div className="text-gray-600 text-sm border border-gray-800 rounded-lg p-8 text-center">
            No attestations yet. Complete a task to generate one.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {attestations.slice(0, 3).map((a: any) => (
              <AttestationCard key={a.id} attestation={a} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
