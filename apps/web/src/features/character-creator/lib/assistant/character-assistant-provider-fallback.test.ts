import { EventType } from '@tanstack/ai';
import type { StreamChunk } from '@tanstack/ai';
import { describe, expect, it, vi } from 'vitest';

import { fallbackFromUnsupportedToolUse, isUnsupportedToolUseError } from './character-assistant-provider-fallback';

async function collect(stream: AsyncIterable<StreamChunk>) {
  const chunks: StreamChunk[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return chunks;
}

async function* createStream(chunks: StreamChunk[]) {
  yield* chunks;
}

describe('character assistant provider fallback', () => {
  it('recognizes nested provider tool-capability errors', () => {
    expect(
      isUnsupportedToolUseError(
        new AggregateError([new Error('No endpoints found that support tool use')], 'Provider request failed'),
      ),
    ).toBe(true);
    expect(isUnsupportedToolUseError(new Error('Authentication failed'))).toBe(false);
  });

  it('replaces an unsupported native run before any content is emitted', async () => {
    const structuredFactory = vi.fn(() =>
      createStream([
        { type: EventType.RUN_STARTED, threadId: 'structured-thread', runId: 'structured-run' },
        { type: EventType.RUN_FINISHED, threadId: 'structured-thread', runId: 'structured-run' },
      ]),
    );
    const chunks = await collect(
      fallbackFromUnsupportedToolUse(
        createStream([
          { type: EventType.RUN_STARTED, threadId: 'native-thread', runId: 'native-run' },
          {
            type: EventType.RUN_ERROR,
            message: 'This model does not support tool calls',
            code: 'unsupported_tools',
          },
        ]),
        structuredFactory,
      ),
    );

    expect(structuredFactory).toHaveBeenCalledOnce();
    expect(chunks).toEqual([
      { type: EventType.RUN_STARTED, threadId: 'structured-thread', runId: 'structured-run' },
      { type: EventType.RUN_FINISHED, threadId: 'structured-thread', runId: 'structured-run' },
    ]);
  });

  it('does not restart a run after native content has been emitted', async () => {
    const structuredFactory = vi.fn(() => createStream([]));
    const nativeChunks: StreamChunk[] = [
      { type: EventType.RUN_STARTED, threadId: 'native-thread', runId: 'native-run' },
      { type: EventType.TEXT_MESSAGE_START, messageId: 'message', role: 'assistant' },
      { type: EventType.RUN_ERROR, message: 'This model does not support tool calls' },
    ];
    const chunks = await collect(fallbackFromUnsupportedToolUse(createStream(nativeChunks), structuredFactory));

    expect(structuredFactory).not.toHaveBeenCalled();
    expect(chunks).toEqual(nativeChunks);
  });
});
