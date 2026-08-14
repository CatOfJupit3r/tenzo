import { createFileRoute } from '@tanstack/react-router';
import { ZodError } from 'zod';

import { CHARACTER_GENERATION_STREAM_REQUEST_SCHEMA } from '@~/features/character-creator/lib/generation/generation-stream-contracts';
import { streamCharacterText } from '@~/features/character-creator/lib/generation/tanstack-ai-text-generation';

export const Route = createFileRoute('/api/character-generate')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const payload = CHARACTER_GENERATION_STREAM_REQUEST_SCHEMA.parse((await request.json()) as unknown);
          const result = streamCharacterText({
            ...payload,
            signal: request.signal,
          });

          return new Response(result.textStream.pipeThrough(new TextEncoderStream()), {
            headers: {
              'Cache-Control': 'no-store',
              'Content-Type': 'text/plain; charset=utf-8',
            },
          });
        } catch (error) {
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
