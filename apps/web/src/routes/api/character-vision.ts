import { createFileRoute } from '@tanstack/react-router';
import { ZodError } from 'zod';

import { REQUEST_MODES } from '@~/features/character-creator/lib/generation/generation-config';
import {
  CHARACTER_VISION_REQUEST_SCHEMA,
  CHARACTER_VISION_RESPONSE_SCHEMA,
} from '@~/features/character-creator/lib/vision/character-vision-contracts';
import { analyzeCharacterImage } from '@~/features/character-creator/lib/vision/character-vision.server';
import { loggerFactory } from '@~/lib/logging/logger';

const MAX_VISION_REQUEST_BYTES = 3_000_000;
const CHARACTER_VISION_ROUTE_LOGGER = loggerFactory.getLogger('api.character-vision');

export const Route = createFileRoute('/api/character-vision')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let requestContext: Record<string, unknown> = {
          operation: 'character-vision',
          requestMode: REQUEST_MODES.proxy,
        };

        try {
          const body = await request.arrayBuffer();
          requestContext = { ...requestContext, requestBytes: body.byteLength };
          if (body.byteLength > MAX_VISION_REQUEST_BYTES) {
            return new Response('Vision request is too large. Choose a smaller image.', {
              status: 400,
              headers: { 'Cache-Control': 'no-store' },
            });
          }

          const payload = CHARACTER_VISION_REQUEST_SCHEMA.parse(JSON.parse(new TextDecoder().decode(body)) as unknown);
          requestContext = {
            ...requestContext,
            model: payload.model,
          };
          CHARACTER_VISION_ROUTE_LOGGER.debug('Character vision request accepted', requestContext);
          const analysis = await analyzeCharacterImage(payload);
          const response = CHARACTER_VISION_RESPONSE_SCHEMA.parse({ analysis });

          CHARACTER_VISION_ROUTE_LOGGER.debug('Character vision request completed', requestContext);

          return Response.json(response, {
            headers: { 'Cache-Control': 'no-store' },
          });
        } catch (error) {
          const isAbortError =
            request.signal.aborted ||
            (error instanceof Error && (error.name === 'AbortError' || error.name === 'RequestAbortedError'));
          if (!(error instanceof ZodError) && !(error instanceof SyntaxError) && !isAbortError) {
            CHARACTER_VISION_ROUTE_LOGGER.error('Character vision request failed', error, requestContext);
          }

          return new Response(error instanceof Error ? error.message : 'Character image analysis failed.', {
            status: error instanceof ZodError || error instanceof SyntaxError ? 400 : 500,
            headers: { 'Cache-Control': 'no-store' },
          });
        }
      },
    },
  },
});
