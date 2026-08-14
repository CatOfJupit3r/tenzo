import { createFileRoute } from '@tanstack/react-router';
import { ZodError, z } from 'zod';

import {
  CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CARD_SCHEMA,
  CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORY_SCHEMA,
  CHARACTER_CONCEPT_SCHEMA,
} from '@~/features/character-creator/lib/assistant/character-assistant-contracts';
import { CHARACTER_GENERATION_STREAM_REQUEST_SCHEMA } from '@~/features/character-creator/lib/generation/generation-stream-contracts';
import { generateValidatedObject } from '@~/features/character-creator/lib/generation/structured-output.server';
import {
  createCharacterModelOptions,
  createCharacterTextAdapter,
} from '@~/features/character-creator/lib/generation/tanstack-ai-text-generation';

const DISCOVERY_CARD_TITLE_SCHEMA = CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CARD_SCHEMA.shape.title
  .min(3, 'Direction titles must be at least 3 characters long.')
  .max(140, 'Direction titles cannot exceed 140 characters.');
const DISCOVERY_CARD_DESCRIPTION_SCHEMA = CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CARD_SCHEMA.shape.description
  .min(24, 'Direction descriptions must be at least 24 characters long.')
  .max(600, 'Direction descriptions cannot exceed 600 characters.');

const DISCOVERY_ROUTE_REQUEST_SCHEMA = CHARACTER_GENERATION_STREAM_REQUEST_SCHEMA.omit({
  instructions: true,
  messages: true,
}).extend({
  originalPremise: CHARACTER_CONCEPT_SCHEMA.shape.premise,
  category: CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORY_SCHEMA,
});

const DISCOVERY_ROUTE_GENERATED_CARD_SCHEMA = z.object({
  title: DISCOVERY_CARD_TITLE_SCHEMA,
  description: DISCOVERY_CARD_DESCRIPTION_SCHEMA,
});

const DISCOVERY_ROUTE_GENERATED_RESPONSE_SCHEMA = z.object({
  cards: z.array(DISCOVERY_ROUTE_GENERATED_CARD_SCHEMA).length(3),
});

const DISCOVERY_SOURCE_ID_PREFIX = 'discovery-directions';
const DISCOVERY_ROUTE_RESPONSE_SCHEMA = z.object({
  cards: z
    .array(
      CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CARD_SCHEMA.extend({
        sourceCardId: z.null(),
      }),
    )
    .length(3),
});

function buildDiscoveryPrompt(
  originalPremise: string,
  category: z.infer<typeof CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORY_SCHEMA>,
) {
  return [
    `Create exactly three creative direction cards for the following discovery category: ${category}.`,
    `Original premise: ${originalPremise}`,
    'Return three materially different ideas with short, concrete titles and detailed yet concise descriptions.',
    'Use only JSON-compatible plain text. Titles and descriptions should be suitable for reuse in a roleplay creative direction screen.',
  ].join(' ');
}

function buildDirectionCardId(category: string, index: number) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${DISCOVERY_SOURCE_ID_PREFIX}-${category}-${index}-${crypto.randomUUID()}`;
  }

  return `${DISCOVERY_SOURCE_ID_PREFIX}-${category}-${index}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function isMateriallyDistinct(values: readonly { title: string; description: string }[]) {
  const normalizedTitles = new Set<string>();
  const normalizedDescriptions = new Set<string>();

  for (const value of values) {
    const title = value.title.trim().toLowerCase();
    const description = value.description.trim().toLowerCase();
    if (normalizedTitles.has(title) || normalizedDescriptions.has(description)) {
      return false;
    }

    normalizedTitles.add(title);
    normalizedDescriptions.add(description);
  }

  return true;
}

export async function handleCharacterAssistantDiscoveryRequest({ request }: { request: Request }) {
  let payload: z.infer<typeof DISCOVERY_ROUTE_REQUEST_SCHEMA>;

  try {
    payload = DISCOVERY_ROUTE_REQUEST_SCHEMA.parse((await request.json()) as unknown);
  } catch (error) {
    return new Response(error instanceof Error ? error.message : 'Discovery request was invalid.', {
      status: error instanceof ZodError || error instanceof SyntaxError ? 400 : 500,
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  }

  const adapter = createCharacterTextAdapter({
    endpoint: payload.endpoint,
    apiKey: payload.apiKey,
    model: payload.model,
  });

  try {
    const generated = await generateValidatedObject({
      adapter,
      schema: DISCOVERY_ROUTE_GENERATED_RESPONSE_SCHEMA,
      schemaDescription: 'Exactly three distinct roleplay discovery direction cards.',
      system: 'Generate high-signal direction card text for roleplay concept work only.',
      prompt: buildDiscoveryPrompt(payload.originalPremise, payload.category),
      modelOptions: createCharacterModelOptions(payload.endpoint, payload),
      abortSignal: request.signal,
    });

    if (!isMateriallyDistinct(generated.cards)) {
      throw new Error('The model returned non-distinct direction cards.');
    }

    const { category } = payload;
    const cards = generated.cards.map((card, index) => ({
      id: buildDirectionCardId(category, index + 1),
      category,
      title: card.title,
      description: card.description,
      sourceCardId: null,
      isUserAuthored: false,
    }));

    const response = DISCOVERY_ROUTE_RESPONSE_SCHEMA.parse({ cards });

    return Response.json(response, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : 'Failed to generate discovery directions.', {
      status: 500,
      headers: {
        'Cache-Control': 'no-store',
      },
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
