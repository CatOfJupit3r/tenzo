import { createFileRoute } from '@tanstack/react-router';
import { createTextStreamResponse } from 'ai';
import { ZodError } from 'zod';

import { streamCharacterText } from '@~/features/character-creator/lib/ai-sdk-text-generation';
import { CHARACTER_GENERATION_STREAM_REQUEST_SCHEMA } from '@~/features/character-creator/lib/generation-stream-contracts';

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

          return createTextStreamResponse({
            headers: {
              'Cache-Control': 'no-store',
            },
            stream: result.textStream,
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
