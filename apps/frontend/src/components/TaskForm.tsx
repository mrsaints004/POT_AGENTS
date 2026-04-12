"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain, useChainId } from "wagmi";
import { parseUnits } from "viem";
import { api } from "@/lib/api";
import { kiteTestnet } from "@/lib/wagmi";

const TASK_TYPES = [
  { value: "text-generation", label: "Text Generation" },
  { value: "translation", label: "Translation" },
  { value: "code-review", label: "Code Review" },
  { value: "summarization", label: "Summarization" },
  { value: "custom", label: "Custom" },
];

const AI_PROVIDERS = [
  { value: "", label: "Auto (Best Match)" },
  { value: "claude-sonnet", label: "Claude Sonnet" },
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gemini-pro", label: "Gemini Pro" },
  { value: "gemini-flash", label: "Gemini Flash" },
  { value: "deepseek-chat", label: "DeepSeek" },
];

const ACCEPTED_FILE_TYPES = ".pdf,.txt,.docx,.csv";

const TEST_USDT_ADDRESS = "0x0fF5393387ad2f9f691FD6Fd28e07E3969e27e63" as const;

const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

const ESCROW_ABI = [
  {
    name: "depositForTask",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_taskId", type: "string" },
      { name: "_amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

type TxStep = "idle" | "approving" | "depositing" | "creating" | "done";

interface CostEstimate {
  subtaskCount: number;
  estimatedCostUsd: number;
  breakdown: { subtask: string; provider: string; estimatedCostUsd: number }[];
  recommendedEscrow: number;
}

export function TaskForm() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const isWrongNetwork = isConnected && chainId !== kiteTestnet.id;
  const [type, setType] = useState("text-generation");
  const [input, setInput] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [preferredProvider, setPreferredProvider] = useState("");
  const [compareMode, setCompareMode] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [txStep, setTxStep] = useState<TxStep>("idle");
  const [estimate, setEstimate] = useState<CostEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const contractAddress = process.env.NEXT_PUBLIC_PROOF_OF_THOUGHT_CONTRACT as `0x${string}` | undefined;

  const effectiveInput = type === "custom" && customDescription
    ? `[Custom Task: ${customDescription}]\n\n${input}`
    : input;

  // Debounced cost estimation
  const fetchEstimate = useCallback((taskType: string, taskInput: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!taskInput.trim()) {
      setEstimate(null);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setEstimating(true);
      try {
        const est = await api.estimateCost({ type: taskType, input: taskInput });
        setEstimate(est);
      } catch {
        // Silently fail — estimate is optional
      } finally {
        setEstimating(false);
      }
    }, 500);
  }, []);

  useEffect(() => {
    fetchEstimate(type, effectiveInput);
  }, [type, effectiveInput, fetchEstimate]);

  const escrowAmount = estimate?.recommendedEscrow ?? 0.01;
  const escrowParsed = parseUnits(escrowAmount.toFixed(6), 6);

  const {
    writeContract: writeApprove,
    data: approveHash,
    isPending: isApprovePending,
  } = useWriteContract();

  const { isLoading: isApproveConfirming } =
    useWaitForTransactionReceipt({ hash: approveHash });

  const {
    writeContract: writeDeposit,
    data: depositHash,
    isPending: isDepositPending,
  } = useWriteContract();

  const { isLoading: isDepositConfirming } =
    useWaitForTransactionReceipt({ hash: depositHash });

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isLoading = txStep !== "idle" && txStep !== "done";

  const getStatusText = () => {
    switch (txStep) {
      case "approving":
        return isApprovePending
          ? "Confirm approval in MetaMask..."
          : isApproveConfirming
            ? "Approving USDT..."
            : "Approving...";
      case "depositing":
        return isDepositPending
          ? "Confirm deposit in MetaMask..."
          : isDepositConfirming
            ? "Depositing to escrow..."
            : "Depositing...";
      case "creating":
        return "Creating task...";
      default:
        return "Submit Task";
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) setFile(droppedFile);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) setFile(selectedFile);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !address || !contractAddress) return;
    setError("");

    try {
      const taskId = crypto.randomUUID();

      setTxStep("approving");
      const approveResult = await new Promise<`0x${string}`>((resolve, reject) => {
        writeApprove(
          {
            address: TEST_USDT_ADDRESS,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [contractAddress, escrowParsed],
            chain: kiteTestnet,
          },
          {
            onSuccess: (hash) => resolve(hash),
            onError: (err) => reject(err),
          }
        );
      });

      await waitForTx(approveResult);

      setTxStep("depositing");
      const depositResult = await new Promise<`0x${string}`>((resolve, reject) => {
        writeDeposit(
          {
            address: contractAddress,
            abi: ESCROW_ABI,
            functionName: "depositForTask",
            args: [taskId, escrowParsed],
            chain: kiteTestnet,
          },
          {
            onSuccess: (hash) => resolve(hash),
            onError: (err) => reject(err),
          }
        );
      });

      await waitForTx(depositResult);

      setTxStep("creating");

      if (file) {
        const formData = new FormData();
        formData.append("type", type);
        formData.append("input", effectiveInput);
        formData.append("maxCostUsd", escrowAmount.toString());
        formData.append("escrowTxHash", depositResult);
        formData.append("depositorAddress", address);
        formData.append("taskId", taskId);
        if (preferredProvider) formData.append("preferredProvider", preferredProvider);
        if (compareMode) formData.append("compareMode", "true");
        formData.append("file", file);

        const { taskId: createdTaskId } = await api.createTask(formData);
        setTxStep("done");
        router.push(`/tasks/${createdTaskId}`);
      } else {
        const { taskId: createdTaskId } = await api.createTask({
          type,
          input: effectiveInput,
          maxCostUsd: escrowAmount,
          escrowTxHash: depositResult,
          depositorAddress: address,
          taskId,
          ...(preferredProvider ? { preferredProvider } : {}),
          ...(compareMode ? { compareMode: true } : {}),
        });
        setTxStep("done");
        router.push(`/tasks/${createdTaskId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transaction failed");
      setTxStep("idle");
    }
  };

  if (!mounted) {
    return <div className="py-12" />;
  }

  if (!isConnected) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 text-lg mb-2">Wallet not connected</p>
        <p className="text-gray-500 text-sm">
          Connect your wallet using the button in the navigation bar to create tasks.
        </p>
      </div>
    );
  }

  if (isWrongNetwork) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400 text-lg mb-2">Wrong Network</p>
        <p className="text-gray-500 text-sm mb-4">
          Please switch to Kite AI Testnet to create tasks.
        </p>
        <button
          onClick={() => switchChain({ chainId: kiteTestnet.id })}
          className="px-4 py-2 rounded-lg bg-kite-600 hover:bg-kite-700 text-white text-sm transition"
        >
          Switch to Kite Testnet
        </button>
      </div>
    );
  }

  if (!contractAddress) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400 text-lg mb-2">Contract not configured</p>
        <p className="text-gray-500 text-sm">
          Set NEXT_PUBLIC_PROOF_OF_THOUGHT_CONTRACT in your environment.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Task Type */}
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-2">Task Type</label>
        <div className="grid grid-cols-3 gap-2">
          {TASK_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              className={`px-4 py-3 rounded-lg border text-sm transition ${
                type === t.value
                  ? "border-kite-500 bg-kite-500/10 text-kite-400"
                  : "border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Task Description */}
      {type === "custom" && (
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">Custom Task Instructions</label>
          <input
            type="text"
            value={customDescription}
            onChange={(e) => setCustomDescription(e.target.value)}
            placeholder="Describe what the AI should do (e.g., 'Write a business plan', 'Analyze sentiment')"
            className="w-full rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 text-gray-200 placeholder-gray-600 focus:border-kite-500 focus:outline-none focus:ring-1 focus:ring-kite-500"
          />
        </div>
      )}

      {/* AI Provider Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-2">AI Provider</label>
        {!compareMode && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            {AI_PROVIDERS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPreferredProvider(p.value)}
                className={`px-3 py-2 rounded-lg border text-xs transition ${
                  preferredProvider === p.value
                    ? "border-kite-500 bg-kite-500/10 text-kite-400"
                    : "border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-700"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
        {/* Compare Providers Toggle */}
        <button
          type="button"
          onClick={() => {
            setCompareMode(!compareMode);
            if (!compareMode) setPreferredProvider("");
          }}
          className={`w-full px-4 py-3 rounded-lg border text-sm font-medium transition flex items-center justify-center gap-2 ${
            compareMode
              ? "border-purple-500 bg-purple-500/10 text-purple-400"
              : "border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-700"
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
          {compareMode ? "Compare Mode ON" : "Compare Providers"}
        </button>
        {compareMode && (
          <p className="text-xs text-purple-400/70 mt-2">
            Your task will run on all available AI providers simultaneously for side-by-side comparison.
          </p>
        )}
      </div>

      {/* File Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-2">Upload Document (optional)</label>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleFileDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition ${
            dragOver
              ? "border-kite-500 bg-kite-500/10"
              : file
                ? "border-emerald-500/50 bg-emerald-500/5"
                : "border-gray-700 hover:border-gray-600"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            onChange={handleFileSelect}
            className="hidden"
          />
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <span className="text-emerald-400 text-sm font-medium">{file.name}</span>
              <span className="text-gray-500 text-xs">({(file.size / 1024).toFixed(1)} KB)</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setFile(null); }}
                className="text-red-400 hover:text-red-300 text-xs ml-2"
              >
                Remove
              </button>
            </div>
          ) : (
            <div>
              <p className="text-gray-500 text-sm">Drag & drop or click to upload</p>
              <p className="text-gray-600 text-xs mt-1">PDF, DOCX, CSV, TXT (max 10MB)</p>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-2">Input</label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={6}
          required
          placeholder="Enter your task input here..."
          className="w-full rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 text-gray-200 placeholder-gray-600 focus:border-kite-500 focus:outline-none focus:ring-1 focus:ring-kite-500 resize-none"
        />
      </div>

      {/* Cost Estimate Breakdown */}
      {(estimate || estimating) && (
        <div className="border border-gray-800 rounded-lg p-4 bg-gray-900/50 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-400">Cost Estimate</span>
            {estimating && (
              <div className="h-3 w-3 border-2 border-kite-400 border-t-transparent rounded-full animate-spin" />
            )}
          </div>
          {estimate && (
            <>
              <div className="text-xs text-gray-500">
                {estimate.subtaskCount} subtask{estimate.subtaskCount > 1 ? "s" : ""} estimated
              </div>
              <div className="space-y-1.5">
                {estimate.breakdown.map((b, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">{b.subtask}</span>
                    <span className="text-gray-500">
                      {b.provider} &middot; ${b.estimatedCostUsd.toFixed(6)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-800 pt-2 flex items-center justify-between">
                <span className="text-sm text-gray-300">Recommended Escrow</span>
                <span className="text-sm font-medium text-kite-400">
                  {escrowAmount} USDT
                </span>
              </div>
            </>
          )}
        </div>
      )}

      <div className="text-sm text-gray-500 bg-gray-900/50 border border-gray-800 rounded-lg px-4 py-3">
        <span className="text-emerald-400 font-medium">Escrow Payment:</span>{" "}
        {escrowAmount} Test USDT will be deposited from your wallet to the escrow contract.
        MetaMask will prompt you to approve and then deposit.
        Payment is released to the agent upon task completion.
      </div>

      {txStep !== "idle" && txStep !== "done" && (
        <div className="flex items-center gap-3 text-sm bg-kite-500/10 border border-kite-500/20 rounded-lg px-4 py-3">
          <div className="h-4 w-4 border-2 border-kite-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-kite-400">{getStatusText()}</span>
        </div>
      )}

      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading || !input.trim()}
        className="w-full py-3 px-4 rounded-lg bg-kite-600 hover:bg-kite-700 text-white font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? getStatusText() : `Approve & Deposit ${escrowAmount} USDT`}
      </button>
    </form>
  );
}

/** Poll for transaction receipt */
async function waitForTx(hash: string, maxAttempts = 60): Promise<void> {
  const rpc = "https://rpc-testnet.gokite.ai/";
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getTransactionReceipt",
        params: [hash],
      }),
    });
    const data = await res.json();
    if (data.result) {
      if (data.result.status === "0x0") throw new Error("Transaction reverted");
      return;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("Transaction confirmation timeout");
}
