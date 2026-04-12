"use client";

const ACTION_COLORS: Record<string, string> = {
  "task-received": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "discover-providers": "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "score-providers": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  "select-provider": "bg-green-500/20 text-green-400 border-green-500/30",
  "execute-start": "bg-orange-500/20 text-orange-400 border-orange-500/30",
  "execute-complete": "bg-green-500/20 text-green-400 border-green-500/30",
  "compute-hash": "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  "attestation-recorded": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  "attestation-skipped": "bg-gray-500/20 text-gray-400 border-gray-500/30",
  "attestation-failed": "bg-red-500/20 text-red-400 border-red-500/30",
  "task-finalized": "bg-kite-500/20 text-kite-400 border-kite-500/30",
  "task-decomposed": "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  "subtask-start": "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "subtask-complete": "bg-lime-500/20 text-lime-400 border-lime-500/30",
  "cost-tracking": "bg-pink-500/20 text-pink-400 border-pink-500/30",
};

export function ReasoningViewer({ steps }: { steps: any[] }) {
  if (steps.length === 0) {
    return (
      <div className="text-gray-500 text-sm py-4 text-center">
        Waiting for reasoning steps...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {steps.map((step, i) => {
        const colors = ACTION_COLORS[step.action] || "bg-gray-500/20 text-gray-400 border-gray-500/30";
        return (
          <div key={step.id || i} className="flex gap-3 items-start">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-xs font-mono text-gray-400">
                {step.step + 1}
              </div>
              {i < steps.length - 1 && <div className="w-px h-full bg-gray-800 min-h-[16px]" />}
            </div>
            <div className="flex-1 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${colors}`}>
                  {step.action}
                </span>
                <span className="text-xs text-gray-600">
                  {new Date(step.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-sm text-gray-300">{step.description}</p>
              {step.data && (
                <details className="mt-1">
                  <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400">
                    View data
                  </summary>
                  <pre className="mt-1 text-xs bg-gray-900 rounded p-2 overflow-x-auto text-gray-400">
                    {JSON.stringify(step.data, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
