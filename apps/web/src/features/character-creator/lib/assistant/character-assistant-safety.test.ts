import { EventType } from '@tanstack/ai';
import { describe, expect, it } from 'vitest';

import { CHARACTER_ASSISTANT_TOOL_NAMES } from './character-assistant-contracts';
import {
  aggregateTokenUsage,
  createCharacterAssistantSafetyMiddleware,
  MAX_ASSISTANT_PARALLEL_TOOL_CALLS_PER_TURN,
  MAX_ASSISTANT_TOOL_CALLS_PER_RUN,
} from './character-assistant-safety';

describe('character assistant safety middleware', () => {
  it('caps parallel and total tool executions', async () => {
    const middleware = createCharacterAssistantSafetyMiddleware();
    const context = {} as never;
    const callTool = async (index: number) =>
      middleware.onBeforeToolCall?.(context, {
        toolCall: {} as never,
        tool: undefined,
        args: {},
        toolName: 'test_tool',
        toolCallId: `tool-${index}`,
      });

    await middleware.onIteration?.(context, { iteration: 0, messageId: 'message-0' });
    for (let index = 0; index < MAX_ASSISTANT_PARALLEL_TOOL_CALLS_PER_TURN; index += 1) {
      expect(await callTool(index)).toBeNull();
    }
    expect(await callTool(MAX_ASSISTANT_PARALLEL_TOOL_CALLS_PER_TURN)).toMatchObject({ type: 'skip' });

    for (
      let index = MAX_ASSISTANT_PARALLEL_TOOL_CALLS_PER_TURN + 1;
      index < MAX_ASSISTANT_TOOL_CALLS_PER_RUN;
      index += 1
    ) {
      await middleware.onIteration?.(context, { iteration: index, messageId: `message-${index}` });
      expect(await callTool(index)).toBeNull();
    }
    expect(await callTool(MAX_ASSISTANT_TOOL_CALLS_PER_RUN)).toMatchObject({ type: 'abort' });
  });

  it('aggregates provider usage across rounds', () => {
    const usage = aggregateTokenUsage(
      { promptTokens: 10, completionTokens: 5, totalTokens: 15, cost: 0.01 },
      { promptTokens: 20, completionTokens: 8, totalTokens: 28, cost: 0.02 },
    );

    expect(usage).toMatchObject({ promptTokens: 30, completionTokens: 13, totalTokens: 43, cost: 0.03 });
  });

  it('turns a run with only failed proposal calls into an error', async () => {
    const middleware = createCharacterAssistantSafetyMiddleware();
    const context = {} as never;
    await middleware.onAfterToolCall?.(context, {
      toolCall: {} as never,
      tool: undefined,
      toolName: CHARACTER_ASSISTANT_TOOL_NAMES.propose_character_fields,
      toolCallId: 'failed-proposal',
      ok: false,
      duration: 1,
      error: new Error('Invalid proposal'),
    });

    const chunk = await middleware.onChunk?.(context, {
      type: EventType.RUN_FINISHED,
      threadId: 'thread',
      runId: 'run',
      finishReason: 'stop',
    });

    expect(chunk).toEqual(expect.objectContaining({ type: EventType.RUN_ERROR }));
  });

  it('allows a run when a later proposal call succeeds', async () => {
    const middleware = createCharacterAssistantSafetyMiddleware();
    const context = {} as never;
    for (const [toolCallId, isOk] of [
      ['failed-proposal', false],
      ['successful-proposal', true],
    ] as const) {
      await middleware.onAfterToolCall?.(context, {
        toolCall: {} as never,
        tool: undefined,
        toolName: CHARACTER_ASSISTANT_TOOL_NAMES.propose_character_fields,
        toolCallId,
        ok: isOk,
        duration: 1,
      });
    }
    const finishedChunk = {
      type: EventType.RUN_FINISHED,
      threadId: 'thread',
      runId: 'run',
      finishReason: 'stop',
    } as const;

    expect(await middleware.onChunk?.(context, finishedChunk)).toEqual(finishedChunk);
  });
});
