"use client";

export function ProviderComparison({ scores }: { scores: any[] }) {
  const filtered = scores?.filter((s: any) => s.provider !== "mock") ?? [];
  if (filtered.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800">
            <th className="text-left py-2 text-gray-500 font-medium">Provider</th>
            <th className="text-right py-2 text-gray-500 font-medium">Cost</th>
            <th className="text-right py-2 text-gray-500 font-medium">Quality</th>
            <th className="text-right py-2 text-gray-500 font-medium">Speed</th>
            <th className="text-right py-2 text-gray-500 font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((s: any, i: number) => (
            <tr key={s.provider} className={`border-b border-gray-800/50 ${i === 0 ? "bg-kite-500/5" : ""}`}>
              <td className="py-2">
                <span className="text-gray-300">{s.provider}</span>
                {i === 0 && (
                  <span className="ml-2 text-xs text-kite-400 bg-kite-500/20 px-1.5 py-0.5 rounded">
                    selected
                  </span>
                )}
              </td>
              <td className="text-right py-2 text-gray-400">{s.costScore}</td>
              <td className="text-right py-2 text-gray-400">{s.qualityScore}</td>
              <td className="text-right py-2 text-gray-400">{s.speedScore}</td>
              <td className="text-right py-2 font-medium text-gray-200">{s.totalScore}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
