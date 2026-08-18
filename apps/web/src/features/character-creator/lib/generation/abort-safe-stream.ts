import { EventType } from '@tanstack/ai';
import type { StreamChunk } from '@tanstack/ai';
import { z } from 'zod';

import { describeGenerationError, getGenerationErrorHint, logGenerationError } from './generation-error';

interface iAbortSafeResponseOptions {
  operation: string;
  model?: string;
}

const ABORT_RUN_ERROR_CHUNK_SCHEMA = z.object({
  type: z.literal(EventType.RUN_ERROR),
  code: z.literal('aborted'),
});

export function isGenerationAbort(error: unknown, signal?: AbortSignal) {
  return (
    signal?.aborted === true ||
    (error instanceof Error && (error.name === 'AbortError' || error.name === 'RequestAbortedError'))
  );
}

export async function* suppressGenerationAbort<T>(stream: AsyncIterable<T>, signal?: AbortSignal): AsyncGenerator<T> {
  try {
    for await (const chunk of stream) {
      if (signal?.aborted && ABORT_RUN_ERROR_CHUNK_SCHEMA.safeParse(chunk).success) {
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

function buildRunErrorMessage(error: unknown, options: iAbortSafeResponseOptions) {
  const modelLabel = options.model?.trim() ? ` for model "${options.model.trim()}"` : '';
  const hint = getGenerationErrorHint(error);
  return `${options.operation} failed${modelLabel}: ${describeGenerationError(error)}${hint ? ` ${hint}` : ''}`;
}

function createRunErrorChunk(error: unknown, options: iAbortSafeResponseOptions): StreamChunk {
  const message = buildRunErrorMessage(error, options);
  return { type: EventType.RUN_ERROR, message, error: { message } };
}

function enrichRunErrorChunk(chunk: StreamChunk, options: iAbortSafeResponseOptions): StreamChunk {
  if (chunk.type !== EventType.RUN_ERROR) return chunk;
  const message = buildRunErrorMessage(chunk, options);
  logGenerationError(`${options.operation}${options.model ? ` · ${options.model}` : ''}`, chunk);
  return {
    ...chunk,
    message,
    error: { ...chunk.error, message },
  };
}

export function toAbortSafeServerSentEventsResponse(
  stream: AsyncIterable<StreamChunk>,
  abortController: AbortController,
  options: iAbortSafeResponseOptions = { operation: 'Character assistant' },
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
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(enrichRunErrorChunk(result.value, options))}\n\n`),
            );
          }
        } catch (error) {
          if (!isCancelled && !isGenerationAbort(error, abortController.signal)) {
            logGenerationError(`${options.operation}${options.model ? ` · ${options.model}` : ''}`, error);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(createRunErrorChunk(error, options))}\n\n`));
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
