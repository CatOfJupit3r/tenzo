import { z } from 'zod';

import { generateValidatedObject } from '../generation/structured-output.server';
import type { iGenerateValidatedObject } from '../generation/structured-output.server';
import {
  createCharacterStructuredModelOptions,
  createCharacterTextAdapter,
} from '../generation/tanstack-ai-text-generation';
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

type iDiscoveryGenerationSettings = Pick<
  iCharacterAssistantStreamRequest,
  'maxTokens' | 'temperature' | 'topP' | 'frequencyPenalty' | 'presencePenalty' | 'topK' | 'minP' | 'openRouterProvider'
>;

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

export interface iCharacterDiscoveryCategoryRequest {
  premise?: string;
  category: z.infer<typeof CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORY_SCHEMA>;
  endpoint: string;
  apiKey: string;
  model: string;
  generationSettings: iDiscoveryGenerationSettings;
  abortSignal?: AbortSignal;
}

export interface iCharacterDiscoveryDirectionsRequest {
  premise?: string;
  endpoint: string;
  apiKey: string;
  model: string;
  generationSettings: iDiscoveryGenerationSettings;
  abortSignal?: AbortSignal;
}

export interface iCharacterDiscoveryDirectionsDependencies {
  generateValidatedObject: iGenerateValidatedObject;
  createTextAdapter: typeof createCharacterTextAdapter;
  createStructuredModelOptions: typeof createCharacterStructuredModelOptions;
}

export interface iCharacterDiscoveryDirectionsService {
  generateCharacterDiscoveryCategory: (
    options: iCharacterDiscoveryCategoryRequest,
  ) => Promise<iCharacterAssistantDiscoveryDirectionCard[]>;
  generateCharacterDiscoveryDirections: (
    options: iCharacterDiscoveryDirectionsRequest,
  ) => Promise<{ cards: iCharacterAssistantDiscoveryDirectionCard[] }>;
}

export function createCharacterDiscoveryDirectionsService(
  dependencies: iCharacterDiscoveryDirectionsDependencies = {
    generateValidatedObject,
    createTextAdapter: createCharacterTextAdapter,
    createStructuredModelOptions: createCharacterStructuredModelOptions,
  },
): iCharacterDiscoveryDirectionsService {
  async function generateCategory({
    premise,
    category,
    endpoint,
    apiKey,
    model,
    generationSettings,
    abortSignal,
  }: iCharacterDiscoveryCategoryRequest) {
    const premiseInstruction = premise?.trim()
      ? `Use this premise as inspiration: ${premise.trim()}`
      : 'Invent varied premises suitable for roleplay; do not assume the user already has a concept.';
    const generated = await dependencies.generateValidatedObject({
      adapter: dependencies.createTextAdapter({ endpoint, apiKey, model }),
      schema: GENERATED_RESPONSE_SCHEMA,
      schemaDescription: 'Exactly three distinct character discovery direction cards.',
      system: 'Generate high-signal, materially distinct creative directions for character design.',
      prompt: `Create exactly three directions for category ${category}. ${premiseInstruction}`,
      modelOptions: dependencies.createStructuredModelOptions(endpoint, generationSettings),
      abortSignal,
    });
    if (!isMateriallyDistinct(generated.cards)) {
      throw new Error('The model returned non-distinct direction cards.');
    }
    return generated.cards.map((card, index) => ({
      id: buildDirectionCardId(category, index),
      category,
      title: card.title,
      description: card.description,
      sourceCardId: null,
      isUserAuthored: false,
    })) satisfies iCharacterAssistantDiscoveryDirectionCard[];
  }

  async function generateDirections({
    premise,
    endpoint,
    apiKey,
    model,
    generationSettings,
    abortSignal,
  }: iCharacterDiscoveryDirectionsRequest) {
    const categories = Object.values(CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES);
    const cards = (
      await Promise.all(
        categories.map(async (category) =>
          generateCategory({
            premise,
            category,
            endpoint,
            apiKey,
            model,
            generationSettings,
            abortSignal,
          }),
        ),
      )
    ).flat();
    return { cards: z.array(CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CARD_SCHEMA).length(12).parse(cards) };
  }

  return {
    generateCharacterDiscoveryCategory: generateCategory,
    generateCharacterDiscoveryDirections: generateDirections,
  };
}

const DEFAULT_CHARACTER_DISCOVERY_DIRECTIONS_SERVICE = createCharacterDiscoveryDirectionsService();

export async function generateCharacterDiscoveryCategory(options: iCharacterDiscoveryCategoryRequest) {
  return DEFAULT_CHARACTER_DISCOVERY_DIRECTIONS_SERVICE.generateCharacterDiscoveryCategory(options);
}

export async function generateCharacterDiscoveryDirections(options: iCharacterDiscoveryDirectionsRequest) {
  return DEFAULT_CHARACTER_DISCOVERY_DIRECTIONS_SERVICE.generateCharacterDiscoveryDirections(options);
}
