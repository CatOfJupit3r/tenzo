import { createFileRoute } from '@tanstack/react-router';
import { ZodError } from 'zod';

import {
  CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORY_SCHEMA,
  CHARACTER_CONCEPT_SCHEMA,
} from '@~/features/character-creator/lib/assistant/character-assistant-contracts';
import { generateCharacterDiscoveryCategory } from '@~/features/character-creator/lib/assistant/discovery-directions.server';
import { CHARACTER_GENERATION_STREAM_REQUEST_SCHEMA } from '@~/features/character-creator/lib/generation/generation-stream-contracts';

const DISCOVERY_ROUTE_REQUEST_SCHEMA = CHARACTER_GENERATION_STREAM_REQUEST_SCHEMA.omit({
  instructions: true,
  messages: true,
}).extend({
  originalPremise: CHARACTER_CONCEPT_SCHEMA.shape.premise,
  category: CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORY_SCHEMA,
});

export async function handleCharacterAssistantDiscoveryRequest({ request }: { request: Request }) {
  try {
    const payload = DISCOVERY_ROUTE_REQUEST_SCHEMA.parse((await request.json()) as unknown);
    const cards = await generateCharacterDiscoveryCategory({
      premise: payload.originalPremise,
      category: payload.category,
      endpoint: payload.endpoint,
      apiKey: payload.apiKey,
      model: payload.model,
      generationSettings: payload,
      abortSignal: request.signal,
    });

    return Response.json({ cards }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const isRequestError = error instanceof ZodError || error instanceof SyntaxError;
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
