import { createFileRoute } from '@tanstack/react-router';
import { ZodError } from 'zod';

import {
  CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORY_SCHEMA,
  CHARACTER_CONCEPT_SCHEMA,
} from '@~/features/character-creator/lib/assistant/character-assistant-contracts';
import { generateCharacterDiscoveryCategory } from '@~/features/character-creator/lib/assistant/discovery-directions.server';
import { REQUEST_MODES } from '@~/features/character-creator/lib/generation/generation-config';
import { CHARACTER_GENERATION_STREAM_REQUEST_SCHEMA } from '@~/features/character-creator/lib/generation/generation-stream-contracts';
import { loggerFactory } from '@~/lib/logging/logger';

const DISCOVERY_ROUTE_REQUEST_SCHEMA = CHARACTER_GENERATION_STREAM_REQUEST_SCHEMA.omit({
  instructions: true,
  messages: true,
}).extend({
  originalPremise: CHARACTER_CONCEPT_SCHEMA.shape.premise,
  category: CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORY_SCHEMA,
});

const CHARACTER_ASSISTANT_DISCOVERY_ROUTE_LOGGER = loggerFactory.getLogger('api.character-assistant-discovery');

export async function handleCharacterAssistantDiscoveryRequest({ request }: { request: Request }) {
  let requestContext: Record<string, unknown> = {
    operation: 'character-assistant-discovery',
    requestMode: REQUEST_MODES.proxy,
  };

  try {
    const payload = DISCOVERY_ROUTE_REQUEST_SCHEMA.parse((await request.json()) as unknown);
    requestContext = {
      ...requestContext,
      category: payload.category,
      providerKind: payload.provider,
      model: payload.model,
    };
    CHARACTER_ASSISTANT_DISCOVERY_ROUTE_LOGGER.debug('Character assistant discovery request accepted', requestContext);
    const cards = await generateCharacterDiscoveryCategory({
      premise: payload.originalPremise,
      category: payload.category,
      endpoint: payload.endpoint,
      apiKey: payload.apiKey,
      model: payload.model,
      generationSettings: payload,
      abortSignal: request.signal,
    });

    CHARACTER_ASSISTANT_DISCOVERY_ROUTE_LOGGER.debug('Character assistant discovery request completed', {
      ...requestContext,
      cardCount: cards.length,
    });

    return Response.json({ cards }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const isRequestError = error instanceof ZodError || error instanceof SyntaxError;
    const isAbortError =
      request.signal.aborted ||
      (error instanceof Error && (error.name === 'AbortError' || error.name === 'RequestAbortedError'));
    if (!isRequestError && !isAbortError) {
      CHARACTER_ASSISTANT_DISCOVERY_ROUTE_LOGGER.error(
        'Character assistant discovery request failed',
        error,
        requestContext,
      );
    }

    return new Response(error instanceof Error ? error.message : 'Failed to generate discovery directions.', {
      status: isRequestError ? 400 : 500,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}

export const Route = createFileRoute('/api/character-assistant-discovery')({
  server: {
    handlers: {
      POST: handleCharacterAssistantDiscoveryRequest,
    },
  },
});
