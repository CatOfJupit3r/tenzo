import { defineChatMiddleware, EventType } from '@tanstack/ai';
import type { TokenUsage } from '@tanstack/ai';

export const MAX_ASSISTANT_TOOL_CALLS_PER_RUN = 12;
export const MAX_ASSISTANT_PARALLEL_TOOL_CALLS_PER_TURN = 4;

export function aggregateTokenUsage(current: TokenUsage | undefined, next: TokenUsage): TokenUsage {
  return {
    promptTokens: (current?.promptTokens ?? 0) + next.promptTokens,
    completionTokens: (current?.completionTokens ?? 0) + next.completionTokens,
    totalTokens: (current?.totalTokens ?? 0) + next.totalTokens,
    ...(current?.durationSeconds !== undefined || next.durationSeconds !== undefined
      ? { durationSeconds: (current?.durationSeconds ?? 0) + (next.durationSeconds ?? 0) }
      : {}),
    ...(current?.unitsBilled !== undefined || next.unitsBilled !== undefined
      ? { unitsBilled: (current?.unitsBilled ?? 0) + (next.unitsBilled ?? 0) }
      : {}),
    ...(current?.cost !== undefined || next.cost !== undefined
      ? { cost: (current?.cost ?? 0) + (next.cost ?? 0) }
      : {}),
  };
}

export function createCharacterAssistantSafetyMiddleware() {
  let parallelToolCallCount = 0;
  let totalToolCallCount = 0;
  let usage: TokenUsage | undefined;

  return defineChatMiddleware({
    name: 'character-assistant-safety',
    onIteration() {
      parallelToolCallCount = 0;
    },
    onBeforeToolCall() {
      parallelToolCallCount += 1;
      totalToolCallCount += 1;
      if (totalToolCallCount > MAX_ASSISTANT_TOOL_CALLS_PER_RUN) {
        return { type: 'abort', reason: 'The assistant exceeded the maximum tool calls for one run.' };
      }
      if (parallelToolCallCount > MAX_ASSISTANT_PARALLEL_TOOL_CALLS_PER_TURN) {
        return {
          type: 'skip',
          result: { error: 'This tool call was skipped because the turn exceeded the parallel tool-call limit.' },
        };
      }
      return null;
    },
    onChunk(_context, chunk) {
      if (chunk.type !== EventType.RUN_FINISHED || !chunk.usage) {
        return chunk;
      }
      usage = aggregateTokenUsage(usage, chunk.usage);
      return { ...chunk, usage };
    },
  });
}
