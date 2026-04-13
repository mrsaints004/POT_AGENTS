"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

interface ComparisonHistoryItem {
  taskId: string;
  taskType: string;
  input: string;
  createdAt: string;
  providersRun: number;
  winner?: string;
  winnerCost: number;
  avgCost: number;
  maxCost: number;
  savings: number;
}

const TASK_TYPE_LABELS: Record<string, string> = {
  "text-generation": "Text Gen",
  translation: "Translation",
  "code-review": "Code Review",
  summarization: "Summary",
  custom: "Custom",
};

export default function ComparisonsPage() {
  const [history, setHistory] = useState<ComparisonHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getComparisonHistory()
      .then(setHistory)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totalComparisons = history.length;
  const totalSaved = history.reduce((sum, h) => sum + h.savings, 0);
  const avgProviders =
    totalComparisons > 0
      ? Math.round(history.reduce((sum, h) => sum + h.providersRun, 0) / totalComparisons * 10) / 10
      : 0;
  const avgSavingsPct =
    totalComparisons > 0
      ? Math.round(
          history
            .filter((h) => h.maxCost > 0 && h.savings > 0)
            .reduce((sum, h) => sum + (h.savings / h.maxCost) * 100, 0) /
            Math.max(1, history.filter((h) => h.maxCost > 0 && h.savings > 0).length)
        )
      : 0;

  if (loading) {
    return <div className="text-gray-500 text-center py-20">Loading comparison history...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Comparison History</h1>
        <p className="text-gray-500 text-sm">
          All Compare Mode tasks with cost savings analytics
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border border-purple-500/30 rounded-lg p-4 bg-purple-500/5">
          <div className="text-2xl font-bold text-purple-400">{totalComparisons}</div>
          <div className="text-xs text-gray-500 mt-1">Total Comparisons</div>
        </div>
        <div className="border border-blue-500/30 rounded-lg p-4 bg-blue-500/5">
          <div className="text-2xl font-bold text-blue-400">{avgProviders}</div>
          <div className="text-xs text-gray-500 mt-1">Avg Providers / Comparison</div>
        </div>
        <div className="border border-emerald-500/30 rounded-lg p-4 bg-emerald-500/5">
          <div className="text-2xl font-bold text-emerald-400">
            ${totalSaved.toFixed(4)}
          </div>
          <div className="text-xs text-gray-500 mt-1">Total Saved</div>
        </div>
        <div className="border border-cyan-500/30 rounded-lg p-4 bg-cyan-500/5">
          <div className="text-2xl font-bold text-cyan-400">{avgSavingsPct}%</div>
          <div className="text-xs text-gray-500 mt-1">Avg Savings %</div>
        </div>
      </div>

      {/* Comparison Table */}
      {history.length === 0 ? (
        <div className="text-center py-12 border border-gray-800 rounded-lg bg-gray-900/50">
          <p className="text-gray-500 text-sm mb-3">No comparisons yet.</p>
          <Link
            href="/tasks/new"
            className="text-kite-400 hover:text-kite-300 text-sm underline"
          >
            Create a task with Compare Mode enabled
          </Link>
        </div>
      ) : (
        <div className="border border-gray-800 rounded-lg bg-gray-900/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800 bg-gray-900">
                  <th className="text-left py-3 px-4 font-medium">Date</th>
                  <th className="text-left py-3 px-4 font-medium">Type</th>
                  <th className="text-left py-3 px-4 font-medium">Input</th>
                  <th className="text-center py-3 px-4 font-medium">Providers</th>
                  <th className="text-left py-3 px-4 font-medium">Winner</th>
                  <th className="text-right py-3 px-4 font-medium">Winner Cost</th>
                  <th className="text-right py-3 px-4 font-medium">Avg Cost</th>
                  <th className="text-right py-3 px-4 font-medium">Savings</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => {
                  const savingsPct =
                    item.maxCost > 0
                      ? Math.round((item.savings / item.maxCost) * 100)
                      : 0;
                  return (
                    <tr
                      key={item.taskId}
                      className="border-b border-gray-800/50 hover:bg-gray-800/30 transition"
                    >
                      <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                          {TASK_TYPE_LABELS[item.taskType] ?? item.taskType}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-300 max-w-[200px] truncate">
                        <Link
                          href={`/tasks/${item.taskId}`}
                          className="hover:text-kite-400 transition"
                        >
                          {item.input}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-center text-gray-400">
                        {item.providersRun}
                      </td>
                      <td className="py-3 px-4">
                        {item.winner ? (
                          <span className="text-kite-400 font-medium">{item.winner}</span>
                        ) : (
                          <span className="text-gray-600 text-xs">Not picked</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right text-emerald-400 font-mono text-xs">
                        ${item.winnerCost.toFixed(6)}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-400 font-mono text-xs">
                        ${item.avgCost.toFixed(6)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {item.savings > 0 ? (
                          <span className="text-emerald-400 font-medium text-xs">
                            ${item.savings.toFixed(6)}{" "}
                            <span className="text-emerald-500/70">({savingsPct}%)</span>
                          </span>
                        ) : (
                          <span className="text-gray-600 text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
