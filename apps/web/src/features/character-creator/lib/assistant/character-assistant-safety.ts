import { defineChatMiddleware, EventType } from '@tanstack/ai';
import type { TokenUsage } from '@tanstack/ai';
import { z } from 'zod';

import { CHARACTER_ASSISTANT_TOOL_NAMES } from './character-assistant-contracts';
import { CHARACTER_ASSISTANT_TOOL_OUTCOMES, logCharacterAssistantTool } from './character-assistant-tool-observability';
import type { CharacterAssistantToolOutcome } from './character-assistant-tool-observability';

export const MAX_ASSISTANT_TOOL_CALLS_PER_RUN = 12;
export const MAX_ASSISTANT_PARALLEL_TOOL_CALLS_PER_TURN = 4;

const PROPOSAL_TOOL_NAMES = new Set<string>([
  CHARACTER_ASSISTANT_TOOL_NAMES.propose_character_fields,
  CHARACTER_ASSISTANT_TOOL_NAMES.propose_tags,
  CHARACTER_ASSISTANT_TOOL_NAMES.propose_alternate_greetings,
  CHARACTER_ASSISTANT_TOOL_NAMES.propose_custom_fields,
  CHARACTER_ASSISTANT_TOOL_NAMES.propose_character_book,
]);
const TOOL_RESULT_SCHEMA = z
  .object({
    isNoOp: z.boolean().optional(),
  })
  .passthrough();

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

export function createCharacterAssistantSafetyMiddleware({ model }: { model?: string } = {}) {
  let parallelToolCallCount = 0;
  let totalToolCallCount = 0;
  let proposalToolCallCount = 0;
  let successfulProposalToolCallCount = 0;
  let usage: TokenUsage | undefined;
  const toolInputs = new Map<string, unknown>();

  return defineChatMiddleware({
    name: 'character-assistant-safety',
    onIteration() {
      parallelToolCallCount = 0;
    },
    onBeforeToolCall(_context, info) {
      toolInputs.set(info.toolCallId, info.args);
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
    onAfterToolCall(_context, info) {
      const parsedResult = TOOL_RESULT_SCHEMA.safeParse(info.result);
      const isNoOp = parsedResult.success && parsedResult.data.isNoOp === true;
      let outcome: CharacterAssistantToolOutcome = CHARACTER_ASSISTANT_TOOL_OUTCOMES.failed;
      if (info.ok) {
        outcome = isNoOp ? CHARACTER_ASSISTANT_TOOL_OUTCOMES['no-op'] : CHARACTER_ASSISTANT_TOOL_OUTCOMES.completed;
      }
      logCharacterAssistantTool({
        mode: 'tool-call',
        model,
        outcome,
        toolCallId: info.toolCallId,
        toolName: info.toolName,
        durationMs: info.duration,
        input: toolInputs.get(info.toolCallId),
        error: info.error,
      });
      toolInputs.delete(info.toolCallId);
      if (!PROPOSAL_TOOL_NAMES.has(info.toolName)) return;
      proposalToolCallCount += 1;
      if (info.ok) successfulProposalToolCallCount += 1;
    },
    onChunk(_context, chunk) {
      if (chunk.type === EventType.RUN_FINISHED && proposalToolCallCount > 0 && successfulProposalToolCallCount === 0) {
        const message =
          'The assistant did not produce a valid character proposal. Review the failed tool call and retry.';
        return { type: EventType.RUN_ERROR, message, error: { message } };
      }
      if (chunk.type !== EventType.RUN_FINISHED || !chunk.usage) {
        return chunk;
      }
      usage = aggregateTokenUsage(usage, chunk.usage);
      return { ...chunk, usage };
    },
  });
}
