import { EventType } from '@tanstack/ai';
import type { StreamChunk } from '@tanstack/ai';

export function isGenerationAbort(error: unknown, signal?: AbortSignal) {
  return (
    signal?.aborted === true ||
    (error instanceof Error && (error.name === 'AbortError' || error.name === 'RequestAbortedError'))
  );
}

export async function* suppressGenerationAbort<T>(stream: AsyncIterable<T>, signal?: AbortSignal): AsyncGenerator<T> {
  try {
    for await (const chunk of stream) {
      if (
        signal?.aborted &&
        typeof chunk === 'object' &&
        chunk !== null &&
        Reflect.get(chunk, 'type') === EventType.RUN_ERROR &&
        Reflect.get(chunk, 'code') === 'aborted'
      ) {
        return;
      }
      yield chunk;
    }
  } catch (error) {
    if (!isGenerationAbort(error, signal)) {
      throw error;
    }
  }
}

function createRunErrorChunk(error: unknown): StreamChunk {
  const message = error instanceof Error ? error.message : 'Character assistant failed.';
  return { type: EventType.RUN_ERROR, message, error: { message } };
}

export function toAbortSafeServerSentEventsResponse(
  stream: AsyncIterable<StreamChunk>,
  abortController: AbortController,
) {
  const encoder = new TextEncoder();
  const iterator = stream[Symbol.asyncIterator]();
  let isCancelled = false;
  let pumpPromise = Promise.resolve();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      pumpPromise = (async () => {
        try {
          while (!isCancelled) {
            const result = await iterator.next();
            if (result.done || isCancelled) break;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(result.value)}\n\n`));
          }
        } catch (error) {
          if (!isCancelled && !isGenerationAbort(error, abortController.signal)) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(createRunErrorChunk(error))}\n\n`));
          }
        } finally {
          if (!isCancelled) controller.close();
        }
      })();
    },
    async cancel(reason) {
      isCancelled = true;
      if (!abortController.signal.aborted) abortController.abort(reason);
      try {
        await iterator.return?.();
        await pumpPromise;
      } catch (error) {
        if (!isGenerationAbort(error, abortController.signal)) throw error;
      }
    },
  });

  return new Response(body, {
    headers: {
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Content-Type': 'text/event-stream',
    },
  });
}
