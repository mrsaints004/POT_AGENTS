"use client";
import Link from "next/link";

export function AttestationCard({ attestation }: { attestation: any }) {
  return (
    <div className="border border-gray-800 rounded-lg p-4 bg-gray-900/50 hover:border-gray-700 transition">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-mono text-gray-500">
          {attestation.id?.substring(0, 8)}...
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-kite-500/20 text-kite-400 border border-kite-500/30">
          {attestation.taskType}
        </span>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Provider</span>
          <span className="text-gray-300">{attestation.providerUsed}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Cost</span>
          <span className="text-gray-300">${attestation.costUsd?.toFixed(6)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Hash</span>
          <span className="text-gray-400 font-mono text-xs truncate max-w-[180px]">
            {attestation.reasoningHash}
          </span>
        </div>
      </div>

      {attestation.txHash && (
        <a
          href={`https://testnet.kitescan.ai/tx/${attestation.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block text-xs text-kite-400 hover:text-kite-300 transition"
        >
          View on Kite Explorer →
        </a>
      )}

      <div className="mt-3 flex gap-2">
        <Link
          href={`/tasks/${attestation.taskId}`}
          className="text-xs text-gray-500 hover:text-gray-300 transition"
        >
          View Task →
        </Link>
      </div>
    </div>
  );
}
