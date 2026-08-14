import { z } from 'zod';

import { generateValidatedObject } from '../generation/structured-output.server';
import { createCharacterModelOptions, createCharacterTextAdapter } from '../generation/tanstack-ai-text-generation';
import {
  CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CARD_SCHEMA,
  CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES,
} from './character-assistant-contracts';
import type {
  iCharacterAssistantDiscoveryDirectionCard,
  iCharacterAssistantStreamRequest,
  CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORY_SCHEMA,
} from './character-assistant-contracts';

const GENERATED_CARD_SCHEMA = z.object({
  title: z.string().trim().min(3).max(140),
  description: z.string().trim().min(24).max(600),
});
const GENERATED_RESPONSE_SCHEMA = z.object({ cards: z.array(GENERATED_CARD_SCHEMA).length(3) });

function buildDirectionCardId(category: string, index: number) {
  return `discovery-${category}-${index}-${crypto.randomUUID()}`;
}

type DiscoveryGenerationSettings = Pick<
  iCharacterAssistantStreamRequest,
  'maxTokens' | 'temperature' | 'topP' | 'frequencyPenalty' | 'presencePenalty' | 'topK' | 'minP'
>;

async function generateCategory({
  premise,
  category,
  endpoint,
  apiKey,
  model,
  generationSettings,
  abortSignal,
}: {
  premise?: string;
  category: z.infer<typeof CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORY_SCHEMA>;
  endpoint: string;
  apiKey: string;
  model: string;
  generationSettings: DiscoveryGenerationSettings;
  abortSignal?: AbortSignal;
}) {
  const premiseInstruction = premise?.trim()
    ? `Use this premise as inspiration: ${premise.trim()}`
    : 'Invent varied premises suitable for roleplay; do not assume the user already has a concept.';
  const generated = await generateValidatedObject({
    adapter: createCharacterTextAdapter({ endpoint, apiKey, model }),
    schema: GENERATED_RESPONSE_SCHEMA,
    schemaDescription: 'Exactly three distinct character discovery direction cards.',
    system: 'Generate high-signal, materially distinct creative directions for character design.',
    prompt: `Create exactly three directions for category ${category}. ${premiseInstruction}`,
    modelOptions: createCharacterModelOptions(endpoint, generationSettings),
    abortSignal,
  });
  return generated.cards.map((card, index) => ({
    id: buildDirectionCardId(category, index),
    category,
    title: card.title,
    description: card.description,
    sourceCardId: null,
    isUserAuthored: false,
  })) satisfies iCharacterAssistantDiscoveryDirectionCard[];
}

export async function generateCharacterDiscoveryDirections({
  premise,
  endpoint,
  apiKey,
  model,
  generationSettings,
  abortSignal,
}: {
  premise?: string;
  endpoint: string;
  apiKey: string;
  model: string;
  generationSettings: DiscoveryGenerationSettings;
  abortSignal?: AbortSignal;
}) {
  const categories = Object.values(CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES);
  const cards = (
    await Promise.all(
      categories.map(async (category) =>
        generateCategory({ premise, category, endpoint, apiKey, model, generationSettings, abortSignal }),
      ),
    )
  ).flat();
  return { cards: z.array(CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CARD_SCHEMA).length(12).parse(cards) };
}
