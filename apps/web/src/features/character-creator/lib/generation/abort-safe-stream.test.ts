import { EventType } from '@tanstack/ai';
import { describe, expect, it } from 'vitest';

import { suppressGenerationAbort, toAbortSafeServerSentEventsResponse } from './abort-safe-stream';

async function collect<T>(stream: AsyncIterable<T>) {
  const values: T[] = [];
  for await (const value of stream) values.push(value);
  return values;
}

describe('abort-safe generation streams', () => {
  it('ends cleanly when the request is aborted', async () => {
    const abortController = new AbortController();
    async function* stream() {
      yield 'started';
      abortController.abort();
      throw new DOMException('Request aborted', 'AbortError');
    }

    await expect(collect(suppressGenerationAbort(stream(), abortController.signal))).resolves.toEqual(['started']);
  });

  it('does not hide non-abort failures', async () => {
    async function* stream() {
      yield 'started';
      throw new Error('Provider failed');
    }

    await expect(collect(suppressGenerationAbort(stream()))).rejects.toThrow('Provider failed');
  });

  it('cancels an active SSE response without rejecting from stream cleanup', async () => {
    const abortController = new AbortController();
    async function* stream() {
      yield { type: EventType.RUN_STARTED, threadId: 'thread', runId: 'run' } as const;
      await new Promise<never>((_resolve, reject) => {
        abortController.signal.addEventListener(
          'abort',
          () => reject(new DOMException('Request aborted', 'AbortError')),
          { once: true },
        );
      });
    }
    const response = toAbortSafeServerSentEventsResponse(
      suppressGenerationAbort(stream(), abortController.signal),
      abortController,
    );
    const reader = response.body?.getReader();
    await reader?.read();

    await expect(reader?.cancel()).resolves.toBeUndefined();
    expect(abortController.signal.aborted).toBe(true);
  });
});
