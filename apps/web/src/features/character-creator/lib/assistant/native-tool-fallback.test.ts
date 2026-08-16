import { EventType } from '@tanstack/ai';
import type { StreamChunk } from '@tanstack/ai';
import { describe, expect, it, vi } from 'vitest';

import {
  createNativeToolRouteKey,
  fallbackFromUnsupportedNativeTools,
  isNativeToolRouteUnsupported,
  markNativeToolRouteUnsupported,
} from './native-tool-fallback';

async function collect(stream: AsyncIterable<StreamChunk>) {
  const chunks: StreamChunk[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  return chunks;
}

describe('native tool compatibility fallback', () => {
  it('caches unsupported capability by endpoint, model, and routing provider', () => {
    const routeKey = createNativeToolRouteKey('HTTPS://OPENROUTER.AI/API/V1', 'Example/Model', 'Example');

    expect(isNativeToolRouteUnsupported(routeKey)).toBe(false);
    markNativeToolRouteUnsupported(routeKey);
    expect(isNativeToolRouteUnsupported(routeKey)).toBe(true);
  });

  it('replaces an uncommitted provider capability error with the fallback stream', async () => {
    async function* nativeStream(): AsyncGenerator<StreamChunk> {
      yield { type: EventType.RUN_STARTED, runId: 'native', threadId: 'thread' };
      yield {
        type: EventType.RUN_ERROR,
        message: 'Provider returned error',
        rawEvent: { error: { metadata: { raw: 'tool_choice="auto" requires --tool-call-parser to be set' } } },
      };
    }
    async function* fallbackStream(): AsyncGenerator<StreamChunk> {
      yield { type: EventType.RUN_STARTED, runId: 'fallback', threadId: 'thread' };
      yield { type: EventType.RUN_FINISHED, runId: 'fallback', threadId: 'thread', finishReason: 'stop' };
    }
    const createFallback = vi.fn(fallbackStream);

    const chunks = await collect(fallbackFromUnsupportedNativeTools(nativeStream(), createFallback));

    expect(createFallback).toHaveBeenCalledOnce();
    expect(chunks).toEqual([
      { type: EventType.RUN_STARTED, runId: 'fallback', threadId: 'thread' },
      { type: EventType.RUN_FINISHED, runId: 'fallback', threadId: 'thread', finishReason: 'stop' },
    ]);
  });

  it('does not restart after assistant output has been committed', async () => {
    async function* nativeStream(): AsyncGenerator<StreamChunk> {
      yield { type: EventType.RUN_STARTED, runId: 'native', threadId: 'thread' };
      yield { type: EventType.TEXT_MESSAGE_START, messageId: 'message', role: 'assistant' };
      yield { type: EventType.RUN_ERROR, message: 'does not support feature: function-calling' };
    }
    const createFallback = vi.fn();

    const chunks = await collect(fallbackFromUnsupportedNativeTools(nativeStream(), createFallback));

    expect(createFallback).not.toHaveBeenCalled();
    expect(chunks.at(-1)?.type).toBe(EventType.RUN_ERROR);
  });
});
