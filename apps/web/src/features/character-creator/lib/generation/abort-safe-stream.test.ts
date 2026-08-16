import { EventType } from '@tanstack/ai';
import { describe, expect, it, vi } from 'vitest';

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

  it('surfaces nested provider metadata in the SSE error event', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const abortController = new AbortController();
    async function* stream() {
      yield { type: EventType.RUN_STARTED, threadId: 'thread', runId: 'run' } as const;
      throw Object.assign(new Error('Provider rejected the request.'), {
        rawEvent: {
          error: {
            code: 400,
            metadata: { error_type: 'invalid_prompt', provider_code: 'tool_call_parse_failed' },
          },
        },
      });
    }

    const response = toAbortSafeServerSentEventsResponse(stream(), abortController, {
      operation: 'Tool request',
      model: 'test/model',
    });

    const body = await response.text();
    expect(body).toContain('Tool request failed for model \\"test/model\\"');
    expect(body).toContain('error_type: invalid_prompt');
    expect(body).toContain('provider_code: tool_call_parse_failed');
    consoleError.mockRestore();
  });

  it('enriches provider RUN_ERROR chunks that do not throw', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const abortController = new AbortController();
    async function* stream() {
      yield {
        type: EventType.RUN_ERROR,
        message: 'Provider returned error',
        code: '500',
        rawEvent: { message: 'Provider returned error', code: 500 },
        error: { message: 'Provider returned error', code: '500' },
      } as const;
    }

    const response = toAbortSafeServerSentEventsResponse(stream(), abortController, {
      operation: 'Tool request',
      model: 'test/model',
    });

    const body = await response.text();
    expect(body).toContain('Tool request failed for model \\"test/model\\"');
    expect(body).toContain('code: 500');
    expect(body).toContain('retry or choose another routing provider');
    consoleError.mockRestore();
  });
});
