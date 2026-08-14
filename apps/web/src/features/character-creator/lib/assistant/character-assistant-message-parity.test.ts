import { EventType, StreamProcessor } from '@tanstack/ai';
import type { StreamChunk } from '@tanstack/ai';
import { describe, expect, it } from 'vitest';

import { CHARACTER_ASSISTANT_TOOL_NAMES } from './character-assistant-contracts';

const PROPOSAL_OUTPUT = {
  proposal: {
    id: 'proposal',
    characterId: 'character',
    toolCallId: 'tool-call',
    summary: 'Add a precise character name.',
    status: 'pending',
    createdAt: '2026-08-14T00:00:00.000Z',
    patches: [],
  },
};

function createLogicalRunFixture(runId: string, messageId: string): StreamChunk[] {
  const finalResponse = { assistantMessage: 'I drafted a name.', followUpSuggestions: ['Define her voice'] };
  const raw = JSON.stringify(finalResponse);
  return [
    { type: EventType.RUN_STARTED, threadId: 'thread', runId },
    { type: EventType.TEXT_MESSAGE_START, messageId, role: 'assistant' },
    { type: EventType.TEXT_MESSAGE_CONTENT, messageId, delta: 'I drafted a name.' },
    { type: EventType.TEXT_MESSAGE_END, messageId },
    {
      type: EventType.TOOL_CALL_START,
      toolCallId: 'tool-call',
      toolCallName: CHARACTER_ASSISTANT_TOOL_NAMES.propose_character_fields,
      toolName: CHARACTER_ASSISTANT_TOOL_NAMES.propose_character_fields,
      parentMessageId: messageId,
    },
    { type: EventType.TOOL_CALL_ARGS, toolCallId: 'tool-call', delta: '{"changes":[]}' },
    {
      type: EventType.TOOL_CALL_END,
      toolCallId: 'tool-call',
      toolCallName: CHARACTER_ASSISTANT_TOOL_NAMES.propose_character_fields,
      toolName: CHARACTER_ASSISTANT_TOOL_NAMES.propose_character_fields,
      input: { changes: [] },
      output: PROPOSAL_OUTPUT,
      result: JSON.stringify(PROPOSAL_OUTPUT),
      state: 'output-available',
    },
    {
      type: EventType.TOOL_CALL_RESULT,
      messageId: `${messageId}-result`,
      toolCallId: 'tool-call',
      content: JSON.stringify(PROPOSAL_OUTPUT),
      role: 'tool',
      state: 'output-available',
    },
    { type: EventType.CUSTOM, name: 'structured-output.start', value: { messageId } },
    { type: EventType.TEXT_MESSAGE_START, messageId, role: 'assistant' },
    { type: EventType.TEXT_MESSAGE_CONTENT, messageId, delta: raw },
    { type: EventType.TEXT_MESSAGE_END, messageId },
    { type: EventType.CUSTOM, name: 'structured-output.complete', value: { object: finalResponse, raw } },
    { type: EventType.RUN_FINISHED, threadId: 'thread', runId, finishReason: 'stop' },
  ];
}

function processFixture(chunks: StreamChunk[]) {
  const processor = new StreamProcessor();
  chunks.forEach((chunk) => processor.processChunk(chunk));
  return processor.getMessages().map((message) => ({
    role: message.role,
    parts: message.parts.map((part) => ({ ...part, id: 'id' in part ? 'normalized' : undefined })),
  }));
}

describe('character assistant message parity', () => {
  it('assembles matching UIMessage parts for native and synthetic logical runs', () => {
    const nativeMessages = processFixture(createLogicalRunFixture('native-run', 'native-message'));
    const syntheticMessages = processFixture(createLogicalRunFixture('synthetic-run', 'synthetic-message'));

    expect(syntheticMessages).toEqual(nativeMessages);
    expect(nativeMessages.flatMap((message) => message.parts).map((part) => part.type)).toEqual([
      'text',
      'tool-call',
      'tool-result',
      'structured-output',
    ]);
  });
});
