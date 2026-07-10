import { createFileRoute } from '@tanstack/react-router';
import { ZodError } from 'zod';

import {
  CHARACTER_VISION_REQUEST_SCHEMA,
  CHARACTER_VISION_RESPONSE_SCHEMA,
} from '@~/features/character-creator/lib/character-vision-contracts';
import { analyzeCharacterImage } from '@~/features/character-creator/lib/character-vision.server';

const MAX_VISION_REQUEST_BYTES = 3_000_000;

export const Route = createFileRoute('/api/character-vision')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.arrayBuffer();
          if (body.byteLength > MAX_VISION_REQUEST_BYTES) {
            return new Response('Vision request is too large. Choose a smaller image.', {
              status: 400,
              headers: { 'Cache-Control': 'no-store' },
            });
          }

          const payload = CHARACTER_VISION_REQUEST_SCHEMA.parse(JSON.parse(new TextDecoder().decode(body)) as unknown);
          const analysis = await analyzeCharacterImage(payload);
          const response = CHARACTER_VISION_RESPONSE_SCHEMA.parse({ analysis });

          return Response.json(response, {
            headers: { 'Cache-Control': 'no-store' },
          });
        } catch (error) {
          return new Response(error instanceof Error ? error.message : 'Character image analysis failed.', {
            status: error instanceof ZodError || error instanceof SyntaxError ? 400 : 500,
            headers: { 'Cache-Control': 'no-store' },
          });
        }
      },
    },
  },
});
