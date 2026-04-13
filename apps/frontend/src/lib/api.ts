const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "API request failed");
  }
  return res.json();
}

async function fetchApiRaw<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "API request failed");
  }
  return res.json();
}

export const api = {
  getTasks: () => fetchApi<any[]>("/api/tasks"),
  getTask: (id: string) => fetchApi<any>(`/api/tasks/${id}`),
  createTask: (data: FormData | {
    type: string;
    input: string;
    maxCostUsd: number;
    escrowTxHash?: string;
    depositorAddress?: string;
    taskId?: string;
    preferredProvider?: string;
    compareMode?: boolean;
  }) => {
    if (data instanceof FormData) {
      // Multipart upload — no Content-Type header (browser sets boundary)
      return fetchApiRaw<{ taskId: string }>("/api/tasks", {
        method: "POST",
        body: data,
      });
    }
    return fetchApi<{ taskId: string }>("/api/tasks", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  estimateCost: (data: { type: string; input: string }) =>
    fetchApi<{
      subtaskCount: number;
      estimatedCostUsd: number;
      breakdown: { subtask: string; provider: string; estimatedCostUsd: number }[];
      recommendedEscrow: number;
    }>("/api/tasks/estimate", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  retryTask: (id: string, preferredProvider?: string) =>
    fetchApi<{ taskId: string }>(`/api/tasks/${id}/retry`, {
      method: "POST",
      body: JSON.stringify({ preferredProvider }),
    }),
  getComparisons: (taskId: string) => fetchApi<any[]>(`/api/tasks/${taskId}/comparisons`),
  pickWinner: (taskId: string, provider: string) =>
    fetchApi<any>(`/api/tasks/${taskId}/pick-winner`, {
      method: "POST",
      body: JSON.stringify({ provider }),
    }),
  getAttestations: () => fetchApi<any[]>("/api/attestations"),
  getAttestation: (id: string) => fetchApi<any>(`/api/attestations/${id}`),
  getAgentProfile: () => fetchApi<any>("/api/agent/profile"),
  getAgentStatus: () => fetchApi<any>("/api/agent/status"),
  getAgentPassport: () => fetchApi<any>("/api/agent/passport"),
  getTaskStats: () => fetchApi<any>("/api/tasks/stats"),
  getComparisonHistory: () => fetchApi<any[]>("/api/tasks/comparisons/history"),
  getGaslessInfo: () => fetchApi<any>("/api/gasless/info"),
  getX402Pricing: () => fetchApi<any>("/api/x402/pricing"),
};

export { API_URL };
