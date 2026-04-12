"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "@/lib/api";
import { useTaskStatus, ComparisonState } from "@/hooks/useTaskStatus";
import { ReasoningViewer } from "@/components/ReasoningViewer";
import { ProviderComparison } from "@/components/ProviderComparison";

const STATUS_COLORS: Record<string, string> = {
  pending: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  processing: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  "selecting-provider": "text-purple-400 bg-purple-500/10 border-purple-500/30",
  executing: "text-orange-400 bg-orange-500/10 border-orange-500/30",
  "recording-attestation": "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
  completed: "text-green-400 bg-green-500/10 border-green-500/30",
  failed: "text-red-400 bg-red-500/10 border-red-500/30",
};

const PROVIDER_OPTIONS = [
  { value: "claude-sonnet", label: "Claude Sonnet" },
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gemini-pro", label: "Gemini Pro" },
  { value: "gemini-flash", label: "Gemini Flash" },
  { value: "deepseek-chat", label: "DeepSeek" },
];

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [task, setTask] = useState<any>(null);
  const [attestation, setAttestation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryProvider, setRetryProvider] = useState("");
  const [retryError, setRetryError] = useState("");
  const [showRetryPicker, setShowRetryPicker] = useState(false);
  const [comparisonResults, setComparisonResults] = useState<any[]>([]);
  const [pickingWinner, setPickingWinner] = useState(false);
  const { status: liveStatus, steps: liveSteps, providerFallback, comparisons, isCompareMode } = useTaskStatus(id);

  useEffect(() => {
    api.getTask(id).then((t) => {
      setTask(t);
      if (t.attestationId) {
        api.getAttestation(t.attestationId).then(setAttestation);
      }
    }).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (liveStatus === "completed") {
      api.getTask(id).then((t) => {
        setTask(t);
        if (t.attestationId) {
          api.getAttestation(t.attestationId).then(setAttestation);
        }
        if (t.compareMode) {
          api.getComparisons(id).then(setComparisonResults);
        }
      });
    }
  }, [liveStatus, id]);

  // Fetch comparison results on load for compare mode tasks
  useEffect(() => {
    if (task?.compareMode) {
      api.getComparisons(id).then(setComparisonResults);
    }
  }, [task?.compareMode, id]);

  const handlePickWinner = async (provider: string) => {
    setPickingWinner(true);
    try {
      const updated = await api.pickWinner(id, provider);
      setTask(updated);
    } catch (err) {
      console.error("Failed to pick winner:", err);
    } finally {
      setPickingWinner(false);
    }
  };

  const handleCopyResult = async () => {
    if (!task?.result) return;
    await navigator.clipboard.writeText(task.result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadResult = () => {
    if (!task?.result) return;
    const blob = new Blob([task.result], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `task-${id.substring(0, 8)}-result.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRetry = async () => {
    setRetrying(true);
    setRetryError("");
    try {
      const { taskId } = await api.retryTask(id, retryProvider || undefined);
      router.push(`/tasks/${taskId}`);
    } catch (err) {
      console.error("Retry failed:", err);
      setRetryError(err instanceof Error ? err.message : "Retry failed. Please try again.");
      setRetrying(false);
    }
  };

  if (loading) {
    return <div className="text-gray-500 text-center py-20">Loading...</div>;
  }

  if (!task) {
    return <div className="text-gray-500 text-center py-20">Task not found</div>;
  }

  const currentStatus = liveStatus !== "pending" ? liveStatus : task.status;
  const steps = liveSteps.length > 0 ? liveSteps : (attestation?.reasoningSteps ?? []);

  const scoreStep = steps.find((s: any) => s.action === "score-providers");
  const providerScores = scoreStep?.data?.scores ?? [];

  const subtaskCompleteSteps = steps.filter((s: any) => s.action === "subtask-complete");
  const costTrackingStep = steps.find((s: any) => s.action === "cost-tracking");

  // Detect fallback from reasoning steps (for already-completed tasks)
  const fallbackStep = steps.find((s: any) => s.action === "provider-fallback");
  const effectiveFallback = providerFallback || (fallbackStep ? {
    requested: fallbackStep.data?.requestedProvider,
    actual: fallbackStep.data?.fallbackProvider,
    message: fallbackStep.description,
  } : null);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold text-white">Task Detail</h1>
          <span
            className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[currentStatus] || "text-gray-400"}`}
          >
            {currentStatus}
          </span>
        </div>
        <p className="text-xs text-gray-600 font-mono">{task.id}</p>
      </div>

      {/* Provider Fallback Notification */}
      {effectiveFallback && (
        <div className="border border-amber-500/30 rounded-lg p-4 bg-amber-500/5 flex items-start gap-3">
          <span className="text-amber-400 text-lg leading-none">&#9888;</span>
          <div>
            <p className="text-amber-400 text-sm font-medium">{effectiveFallback.message}</p>
            <p className="text-gray-500 text-xs mt-1">
              The API key for {effectiveFallback.requested} is not configured. To use this provider, add its API key to the .env file.
            </p>
          </div>
        </div>
      )}

      {/* Retry Lineage */}
      {task.retryOf && (
        <div className="border border-amber-500/30 rounded-lg p-4 bg-amber-500/5">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-amber-400 font-medium">Retry #{task.retryCount ?? 1}</span>
            <span className="text-gray-500">of</span>
            <a
              href={`/tasks/${task.retryOf}`}
              className="text-kite-400 hover:text-kite-300 font-mono text-xs underline"
            >
              {task.retryOf.substring(0, 8)}...
            </a>
          </div>
        </div>
      )}

      {/* Task Info */}
      <div className="border border-gray-800 rounded-lg p-5 bg-gray-900/50 space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Type</span>
            <p className="text-gray-300 mt-0.5">{task.type}</p>
          </div>
          <div>
            <span className="text-gray-500">Max Cost</span>
            <p className="text-gray-300 mt-0.5">${task.maxCostUsd}</p>
          </div>
          {task.selectedProvider && (
            <div>
              <span className="text-gray-500">Provider</span>
              <p className="text-gray-300 mt-0.5">{task.selectedProvider}</p>
            </div>
          )}
          {task.fileName && (
            <div>
              <span className="text-gray-500">Uploaded File</span>
              <p className="text-gray-300 mt-0.5">{task.fileName}</p>
            </div>
          )}
        </div>
        <div>
          <span className="text-gray-500 text-sm">Input</span>
          <p className="text-gray-300 mt-1 text-sm bg-gray-900 rounded p-3 whitespace-pre-wrap">
            {task.input}
          </p>
        </div>

        {/* Result with Markdown rendering (hidden in compare mode — results shown in comparison cards) */}
        {task.result && (!task.compareMode || task.winningProvider) && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-gray-500 text-sm">Result</span>
              <div className="flex gap-2">
                <button
                  onClick={handleCopyResult}
                  className="text-xs px-2.5 py-1 rounded border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition"
                >
                  {copied ? "Copied!" : "Copy Result"}
                </button>
                <button
                  onClick={handleDownloadResult}
                  className="text-xs px-2.5 py-1 rounded border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition"
                >
                  Download .md
                </button>
              </div>
            </div>
            <div className="text-sm bg-gray-900 rounded p-4 prose prose-invert prose-sm max-w-none prose-headings:text-gray-200 prose-p:text-gray-300 prose-strong:text-gray-200 prose-code:text-kite-400 prose-code:bg-gray-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-gray-800 prose-pre:border prose-pre:border-gray-700 prose-li:text-gray-300 prose-a:text-kite-400 prose-hr:border-gray-700 prose-table:text-gray-300 prose-th:text-gray-200 prose-td:border-gray-700 prose-th:border-gray-700">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{task.result}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>

      {/* Compare Mode Results */}
      {(task.compareMode || isCompareMode) && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
            Provider Comparison
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(() => {
              // Merge DB results with live WebSocket data
              const providers: Map<string, { status: string; result?: string; tokensUsed?: number; costUsd?: number; durationMs?: number; error?: string }> = new Map();

              // First populate from DB results
              comparisonResults.forEach((cr: any) => {
                providers.set(cr.provider, {
                  status: cr.status,
                  result: cr.result,
                  tokensUsed: cr.tokensUsed,
                  costUsd: cr.costUsd,
                  durationMs: cr.durationMs,
                  error: cr.error,
                });
              });

              // Override with live WebSocket data (more up-to-date)
              comparisons.forEach((state, provider) => {
                providers.set(provider, {
                  status: state.status,
                  result: state.result,
                  tokensUsed: state.tokensUsed,
                  costUsd: state.costUsd,
                  durationMs: state.durationMs,
                  error: state.error,
                });
              });

              if (providers.size === 0) {
                return (
                  <div className="col-span-2 text-center py-8 text-gray-500">
                    <div className="h-6 w-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    Waiting for providers to start...
                  </div>
                );
              }

              return Array.from(providers.entries()).map(([provider, data]) => {
                const isWinner = task.winningProvider === provider;
                const isCompleted = data.status === "completed";
                const isFailed = data.status === "failed";
                const isRunning = data.status === "executing" || data.status === "pending";

                return (
                  <div
                    key={provider}
                    className={`border rounded-lg p-5 bg-gray-900/50 space-y-3 transition ${
                      isWinner
                        ? "border-purple-500 ring-2 ring-purple-500/30"
                        : isFailed
                          ? "border-red-500/30"
                          : "border-gray-800"
                    }`}
                  >
                    {/* Provider Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${
                          isCompleted ? "bg-green-400" : isFailed ? "bg-red-400" : "bg-yellow-400 animate-pulse"
                        }`} />
                        <span className="text-sm font-semibold text-white">{provider}</span>
                        {isWinner && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                            Winner
                          </span>
                        )}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${
                        isCompleted ? "text-green-400 bg-green-500/10 border-green-500/30" :
                        isFailed ? "text-red-400 bg-red-500/10 border-red-500/30" :
                        "text-yellow-400 bg-yellow-500/10 border-yellow-500/30"
                      }`}>
                        {data.status}
                      </span>
                    </div>

                    {/* Loading State */}
                    {isRunning && (
                      <div className="flex items-center justify-center py-8">
                        <div className="h-6 w-6 border-2 border-kite-400 border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}

                    {/* Error State */}
                    {isFailed && data.error && (
                      <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                        {data.error}
                      </div>
                    )}

                    {/* Result */}
                    {isCompleted && data.result && (
                      <div className="text-sm bg-gray-900 rounded p-3 max-h-[300px] overflow-y-auto prose prose-invert prose-sm max-w-none prose-headings:text-gray-200 prose-p:text-gray-300 prose-strong:text-gray-200 prose-code:text-kite-400 prose-code:bg-gray-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-gray-800 prose-pre:border prose-pre:border-gray-700 prose-li:text-gray-300">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.result}</ReactMarkdown>
                      </div>
                    )}

                    {/* Stats Bar */}
                    {isCompleted && (
                      <div className="flex items-center gap-4 text-xs text-gray-500 border-t border-gray-800 pt-3">
                        <span title="Cost">
                          <span className="text-emerald-400 font-medium">${(data.costUsd ?? 0).toFixed(4)}</span>
                        </span>
                        <span title="Speed">
                          <span className="text-blue-400 font-medium">{((data.durationMs ?? 0) / 1000).toFixed(1)}s</span>
                        </span>
                        <span title="Tokens">
                          <span className="text-gray-400">{data.tokensUsed ?? 0} tokens</span>
                        </span>
                      </div>
                    )}

                    {/* Pick Winner Button */}
                    {isCompleted && !task.winningProvider && currentStatus === "completed" && (
                      <button
                        onClick={() => handlePickWinner(provider)}
                        disabled={pickingWinner}
                        className="w-full py-2 px-3 rounded-lg border border-purple-500/30 text-purple-400 text-sm font-medium hover:bg-purple-500/10 transition disabled:opacity-50"
                      >
                        {pickingWinner ? "Selecting..." : "Pick as Winner"}
                      </button>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* Retry Button */}
      {(currentStatus === "completed" || currentStatus === "failed") && (
        <div className="border border-gray-800 rounded-lg p-5 bg-gray-900/50 space-y-4">
          <h2 className="text-lg font-semibold text-white">Retry with Different AI</h2>
          {!showRetryPicker ? (
            <button
              onClick={() => setShowRetryPicker(true)}
              className="px-4 py-2 rounded-lg bg-kite-600 hover:bg-kite-700 text-white text-sm transition"
            >
              Retry with Different AI
            </button>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {PROVIDER_OPTIONS.filter(p => p.value !== task.selectedProvider).map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setRetryProvider(p.value)}
                    className={`px-3 py-2 rounded-lg border text-xs transition ${
                      retryProvider === p.value
                        ? "border-kite-500 bg-kite-500/10 text-kite-400"
                        : "border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-700"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleRetry}
                  disabled={!retryProvider || retrying}
                  className="px-4 py-2 rounded-lg bg-kite-600 hover:bg-kite-700 text-white text-sm transition disabled:opacity-50"
                >
                  {retrying ? "Retrying..." : "Retry Now"}
                </button>
                <button
                  onClick={() => { setShowRetryPicker(false); setRetryProvider(""); }}
                  className="px-4 py-2 rounded-lg border border-gray-700 text-gray-400 text-sm hover:border-gray-500 transition"
                >
                  Cancel
                </button>
              </div>
              {retryError && (
                <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {retryError}
                </div>
              )}
              <p className="text-xs text-gray-500">
                Retry reuses the same escrow — no new deposit needed.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Provider Comparison */}
      {providerScores.length > 0 && (
        <div className="border border-gray-800 rounded-lg p-5 bg-gray-900/50">
          <h2 className="text-lg font-semibold text-white mb-4">Provider Comparison</h2>
          <ProviderComparison scores={providerScores} />
        </div>
      )}

      {/* Cost Breakdown */}
      {subtaskCompleteSteps.length > 0 && (
        <div className="border border-pink-500/30 rounded-lg p-5 bg-pink-500/5">
          <h2 className="text-lg font-semibold text-pink-400 mb-4">Cost Breakdown</h2>
          <div className="space-y-2">
            {subtaskCompleteSteps.map((s: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 font-mono text-xs w-6">{s.data?.subtaskIndex}</span>
                  <span className="text-gray-300">{s.data?.title}</span>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-gray-500">{s.data?.provider}</span>
                  <span className="text-gray-500">{s.data?.tokensUsed} tokens</span>
                  <span className="text-pink-400 font-medium">{s.data?.costUsd}</span>
                </div>
              </div>
            ))}
            {costTrackingStep && (
              <div className="border-t border-gray-800 pt-2 mt-2 flex justify-between text-sm">
                <span className="text-gray-400 font-medium">Total AI Cost</span>
                <span className="text-pink-400 font-medium">{costTrackingStep.data?.totalCostUsd}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reasoning Timeline */}
      <div className="border border-gray-800 rounded-lg p-5 bg-gray-900/50">
        <h2 className="text-lg font-semibold text-white mb-4">Reasoning Timeline</h2>
        <ReasoningViewer steps={steps} />
      </div>

      {/* Payment Status */}
      {(task.escrowTxHash || task.paymentTxHash || (task.paymentStatus && task.paymentStatus !== "none")) && (
        <div className="border border-emerald-500/30 rounded-lg p-5 bg-emerald-500/5">
          <h2 className="text-lg font-semibold text-emerald-400 mb-3">USDT Escrow Payment</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Payment Status</span>
              <span className={
                task.paymentStatus === "released" ? "text-green-400 font-medium" :
                task.paymentStatus === "escrowed" ? "text-yellow-400 font-medium" :
                "text-gray-400"
              }>
                {task.paymentStatus === "released" ? "Released" :
                 task.paymentStatus === "escrowed" ? "Escrowed" : "None"}
              </span>
            </div>
            {task.escrowTxHash && (
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Escrow Deposit Tx</span>
                <a
                  href={`https://testnet.kitescan.ai/tx/${task.escrowTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:text-emerald-300 font-mono text-xs"
                >
                  {task.escrowTxHash.substring(0, 20)}...
                </a>
              </div>
            )}
            {task.paymentTxHash && (
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Payment Release Tx</span>
                <a
                  href={`https://testnet.kitescan.ai/tx/${task.paymentTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:text-emerald-300 font-mono text-xs"
                >
                  {task.paymentTxHash.substring(0, 20)}...
                </a>
              </div>
            )}
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-800">
              <div className={`w-2 h-2 rounded-full ${task.escrowTxHash ? "bg-green-400" : "bg-gray-600"}`} />
              <span className={task.escrowTxHash ? "text-green-400 text-xs" : "text-gray-600 text-xs"}>Deposited</span>
              <div className="flex-1 h-px bg-gray-800" />
              <div className={`w-2 h-2 rounded-full ${task.paymentStatus === "released" ? "bg-green-400" : "bg-gray-600"}`} />
              <span className={task.paymentStatus === "released" ? "text-green-400 text-xs" : "text-gray-600 text-xs"}>Released</span>
            </div>
          </div>
        </div>
      )}

      {/* On-chain Attestation */}
      {attestation?.txHash && (
        <div className="border border-kite-500/30 rounded-lg p-5 bg-kite-500/5">
          <h2 className="text-lg font-semibold text-kite-400 mb-3">On-Chain Attestation</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Tx Hash</span>
              <a
                href={`https://testnet.kitescan.ai/tx/${attestation.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-kite-400 hover:text-kite-300 font-mono text-xs"
              >
                {attestation.txHash.substring(0, 20)}...
              </a>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Reasoning Hash</span>
              <span className="text-gray-400 font-mono text-xs truncate max-w-[250px]">
                {attestation.reasoningHash}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Verified</span>
              <span className={attestation.verified ? "text-green-400" : "text-red-400"}>
                {attestation.verified ? "Hash matches" : "Mismatch"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
