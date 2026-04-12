"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { AttestationCard } from "@/components/AttestationCard";

export default function AttestationsPage() {
  const [attestations, setAttestations] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAttestations()
      .then(setAttestations)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = attestations.filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.taskId?.toLowerCase().includes(q) ||
      a.taskType?.toLowerCase().includes(q) ||
      a.providerUsed?.toLowerCase().includes(q) ||
      a.txHash?.toLowerCase().includes(q) ||
      a.reasoningHash?.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return <div className="text-gray-500 text-center py-20">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Attestation Explorer</h1>
        <p className="text-gray-500">Browse and verify all on-chain reasoning attestations</p>
      </div>

      <input
        type="text"
        placeholder="Search by task ID, type, provider, or hash..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 text-gray-200 placeholder-gray-600 focus:border-kite-500 focus:outline-none focus:ring-1 focus:ring-kite-500"
      />

      {filtered.length === 0 ? (
        <div className="text-gray-600 text-sm border border-gray-800 rounded-lg p-8 text-center">
          {attestations.length === 0
            ? "No attestations yet. Complete a task to generate one."
            : "No attestations match your search."}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => (
            <AttestationCard key={a.id} attestation={a} />
          ))}
        </div>
      )}
    </div>
  );
}
