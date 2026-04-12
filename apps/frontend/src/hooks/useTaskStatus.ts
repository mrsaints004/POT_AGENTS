"use client";
import { useEffect, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { API_URL } from "@/lib/api";

let socket: Socket | null = null;

function getSocket() {
  if (!socket) {
    socket = io(API_URL, { transports: ["websocket", "polling"] });
  }
  return socket;
}

export interface ComparisonState {
  status: "pending" | "executing" | "completed" | "failed";
  result?: string;
  tokensUsed?: number;
  costUsd?: number;
  durationMs?: number;
  error?: string;
}

export function useTaskStatus(taskId?: string) {
  const [status, setStatus] = useState<string>("pending");
  const [steps, setSteps] = useState<any[]>([]);
  const [attestation, setAttestation] = useState<any>(null);
  const [providerFallback, setProviderFallback] = useState<{ requested: string; actual: string; message: string } | null>(null);
  const [comparisons, setComparisons] = useState<Map<string, ComparisonState>>(new Map());
  const [isCompareMode, setIsCompareMode] = useState(false);

  useEffect(() => {
    const s = getSocket();

    const handleUpdate = (data: any) => {
      if (!taskId || data.taskId === taskId) {
        setStatus(data.status);
        if (data.providerFallback) {
          setProviderFallback(data.providerFallback);
        }
        if (data.compareMode) {
          setIsCompareMode(true);
        }
      }
    };

    const handleStep = (data: any) => {
      if (!taskId || data.taskId === taskId) {
        setSteps((prev) => [...prev, data.step]);
      }
    };

    const handleFinalized = (data: any) => {
      if (!taskId || data.taskId === taskId) {
        setAttestation(data);
      }
    };

    const handleCompareStart = (data: any) => {
      if (!taskId || data.taskId === taskId) {
        setComparisons((prev) => {
          const next = new Map(prev);
          next.set(data.provider, { status: "executing" });
          return next;
        });
      }
    };

    const handleCompareComplete = (data: any) => {
      if (!taskId || data.taskId === taskId) {
        setComparisons((prev) => {
          const next = new Map(prev);
          next.set(data.provider, {
            status: "completed",
            result: data.result,
            tokensUsed: data.tokensUsed,
            costUsd: data.costUsd,
            durationMs: data.durationMs,
          });
          return next;
        });
      }
    };

    const handleCompareFailed = (data: any) => {
      if (!taskId || data.taskId === taskId) {
        setComparisons((prev) => {
          const next = new Map(prev);
          next.set(data.provider, {
            status: "failed",
            error: data.error,
            durationMs: data.durationMs,
          });
          return next;
        });
      }
    };

    s.on("task:update", handleUpdate);
    s.on("attestation:step", handleStep);
    s.on("attestation:finalized", handleFinalized);
    s.on("compare:provider-start", handleCompareStart);
    s.on("compare:provider-complete", handleCompareComplete);
    s.on("compare:provider-failed", handleCompareFailed);

    return () => {
      s.off("task:update", handleUpdate);
      s.off("attestation:step", handleStep);
      s.off("attestation:finalized", handleFinalized);
      s.off("compare:provider-start", handleCompareStart);
      s.off("compare:provider-complete", handleCompareComplete);
      s.off("compare:provider-failed", handleCompareFailed);
    };
  }, [taskId]);

  const reset = useCallback(() => {
    setStatus("pending");
    setSteps([]);
    setAttestation(null);
    setProviderFallback(null);
    setComparisons(new Map());
    setIsCompareMode(false);
  }, []);

  return { status, steps, attestation, providerFallback, comparisons, isCompareMode, reset };
}
