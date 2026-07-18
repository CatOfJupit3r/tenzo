import { createFileRoute } from '@tanstack/react-router';
import { generateObject } from 'ai';
import { ZodError, z } from 'zod';

import { createCharacterLanguageModel } from '@~/features/character-creator/lib/ai-sdk-text-generation';
import {
  CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CARD_SCHEMA,
  CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORY_SCHEMA,
  CHARACTER_CONCEPT_SCHEMA,
} from '@~/features/character-creator/lib/character-assistant-contracts';
import { CHARACTER_GENERATION_STREAM_REQUEST_SCHEMA } from '@~/features/character-creator/lib/generation-stream-contracts';

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
  const normalized = new Set<string>();

  for (const value of values) {
    const title = value.title.trim().toLowerCase();
    const description = value.description.trim().toLowerCase();
    const key = `${title}|${description}`;
    if (normalized.has(key)) {
      return false;
    }

    normalized.add(key);
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

  const model = createCharacterLanguageModel({
    endpoint: payload.endpoint,
    apiKey: payload.apiKey,
    model: payload.model,
    topK: payload.topK,
    minP: payload.minP,
  });

  try {
    const generated = DISCOVERY_ROUTE_GENERATED_RESPONSE_SCHEMA.parse(
      (
        await generateObject({
          model,
          schema: DISCOVERY_ROUTE_GENERATED_RESPONSE_SCHEMA,
          schemaName: 'character_assistant_discovery_direction_cards',
          system: `Generate high-signal direction card text for roleplay concept work only.`,
          prompt: buildDiscoveryPrompt(payload.originalPremise, payload.category),
          temperature: payload.temperature,
          topP: payload.topP,
          maxOutputTokens: Math.max(1, Math.floor(payload.maxTokens)),
        })
      ).object,
    );

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

export const Route = createFileRoute('/api/character-assistant-discovery' as never)({
  server: {
    handlers: {
      POST: handleCharacterAssistantDiscoveryRequest,
    },
  },
});
