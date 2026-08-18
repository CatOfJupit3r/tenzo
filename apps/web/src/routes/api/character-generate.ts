import { createFileRoute } from '@tanstack/react-router';
import { ZodError } from 'zod';

import { REQUEST_MODES } from '@~/features/character-creator/lib/generation/generation-config';
import { CHARACTER_GENERATION_STREAM_REQUEST_SCHEMA } from '@~/features/character-creator/lib/generation/generation-stream-contracts';
import { streamCharacterText } from '@~/features/character-creator/lib/generation/tanstack-ai-text-generation';
import { loggerFactory } from '@~/lib/logging/logger';

const CHARACTER_GENERATION_ROUTE_LOGGER = loggerFactory.getLogger('api.character-generation');

function isCharacterGenerationAbort(error: unknown, signal: AbortSignal) {
  return (
    signal.aborted || (error instanceof Error && (error.name === 'AbortError' || error.name === 'RequestAbortedError'))
  );
}

async function* observeCharacterGenerationStream(
  stream: AsyncIterable<string>,
  signal: AbortSignal,
  requestContext: Record<string, unknown>,
): AsyncGenerator<string> {
  try {
    for await (const chunk of stream) {
      yield chunk;
    }
  } catch (error) {
    if (isCharacterGenerationAbort(error, signal)) {
      return;
    }

    CHARACTER_GENERATION_ROUTE_LOGGER.error('Character generation stream failed', error, requestContext);
    throw error;
  }
}

function toReadableTextStream(stream: AsyncIterable<string>) {
  const iterator = stream[Symbol.asyncIterator]();

  return new ReadableStream<string>({
    async pull(controller) {
      try {
        const result = await iterator.next();
        if (result.done) {
          controller.close();
        } else {
          controller.enqueue(result.value);
        }
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel(reason) {
      await iterator.return?.(reason);
    },
  });
}

export const Route = createFileRoute('/api/character-generate')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let requestContext: Record<string, unknown> = {
          operation: 'character-generation',
          requestMode: REQUEST_MODES.proxy,
        };

        try {
          const payload = CHARACTER_GENERATION_STREAM_REQUEST_SCHEMA.parse((await request.json()) as unknown);
          requestContext = {
            ...requestContext,
            providerKind: payload.provider,
            model: payload.model,
            messageCount: payload.messages.length,
          };
          CHARACTER_GENERATION_ROUTE_LOGGER.debug('Character generation request accepted', requestContext);
          const result = streamCharacterText({
            ...payload,
            signal: request.signal,
          });
          const observedStream = observeCharacterGenerationStream(result.textStream, request.signal, requestContext);

          return new Response(toReadableTextStream(observedStream).pipeThrough(new TextEncoderStream()), {
            headers: {
              'Cache-Control': 'no-store',
              'Content-Type': 'text/plain; charset=utf-8',
            },
          });
        } catch (error) {
          if (
            !(error instanceof ZodError) &&
            !(error instanceof SyntaxError) &&
            !isCharacterGenerationAbort(error, request.signal)
          ) {
            CHARACTER_GENERATION_ROUTE_LOGGER.error('Character generation request failed', error, requestContext);
          }

          return new Response(error instanceof Error ? error.message : 'Generation failed.', {
            status: error instanceof ZodError ? 400 : 500,
            headers: {
              'Cache-Control': 'no-store',
            },
          });
        }
      },
    },
  },
});
