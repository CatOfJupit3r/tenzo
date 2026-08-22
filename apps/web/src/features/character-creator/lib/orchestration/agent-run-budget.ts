export interface iAgentCallUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
}

export interface iAgentRunBudgetLimits {
  maximumCalls: number;
  maximumInputTokens: number;
  maximumOutputTokens: number;
  maximumCostUsd: number;
  maximumLatencyMs: number;
}

export interface iAgentRunBudgetSnapshot extends iAgentCallUsage {
  callCount: number;
  isExhausted: boolean;
}

export function createAgentRunBudget(limits: iAgentRunBudgetLimits) {
  let snapshot: iAgentRunBudgetSnapshot = {
    callCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    latencyMs: 0,
    isExhausted: false,
  };

  const isWithinLimits = (candidate: Omit<iAgentRunBudgetSnapshot, 'isExhausted'>) =>
    candidate.callCount <= limits.maximumCalls &&
    candidate.inputTokens <= limits.maximumInputTokens &&
    candidate.outputTokens <= limits.maximumOutputTokens &&
    candidate.costUsd <= limits.maximumCostUsd &&
    candidate.latencyMs <= limits.maximumLatencyMs;

  return {
    canStartCall() {
      return !snapshot.isExhausted && snapshot.callCount < limits.maximumCalls;
    },
    recordCall(usage: iAgentCallUsage) {
      const usageSnapshot = {
        callCount: snapshot.callCount + 1,
        inputTokens: snapshot.inputTokens + Math.max(0, usage.inputTokens),
        outputTokens: snapshot.outputTokens + Math.max(0, usage.outputTokens),
        costUsd: snapshot.costUsd + Math.max(0, usage.costUsd),
        latencyMs: snapshot.latencyMs + Math.max(0, usage.latencyMs),
      } satisfies Omit<iAgentRunBudgetSnapshot, 'isExhausted'>;
      const candidate = {
        ...usageSnapshot,
        isExhausted: !isWithinLimits(usageSnapshot),
      } satisfies iAgentRunBudgetSnapshot;
      snapshot = candidate;
      return !snapshot.isExhausted;
    },
    getSnapshot() {
      return { ...snapshot };
    },
  };
}
