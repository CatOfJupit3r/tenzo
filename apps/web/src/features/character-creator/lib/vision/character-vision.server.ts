import type { AnyTextAdapter, ModelMessage } from '@tanstack/ai';

import { generateValidatedObject } from '../generation/structured-output.server';
import type { iGenerateValidatedObject } from '../generation/structured-output.server';
import {
  createCharacterStructuredModelOptions,
  createCharacterTextAdapter,
} from '../generation/tanstack-ai-text-generation';
import { CHARACTER_IMAGE_ANALYSIS_SCHEMA, CHARACTER_VISION_REQUEST_SCHEMA } from './character-vision-contracts';
import type { iCharacterImageAnalysis, iCharacterVisionRequest } from './character-vision-contracts';

const VISION_SYSTEM_PROMPT =
  'You describe character reference images for a character card editor. Describe only what is visible; put uncertainty in warnings and lower confidence. Do not invent story details.';

function clampAnalysisArrays(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  const candidate = value as Record<string, unknown>;
  const { appearance } = candidate;
  return {
    ...candidate,
    suggestedTags: Array.isArray(candidate.suggestedTags)
      ? candidate.suggestedTags.slice(0, 10)
      : candidate.suggestedTags,
    warnings: Array.isArray(candidate.warnings) ? candidate.warnings.slice(0, 10) : candidate.warnings,
    appearance:
      appearance && typeof appearance === 'object' && !Array.isArray(appearance)
        ? {
            ...(appearance as Record<string, unknown>),
            notableFeatures: Array.isArray((appearance as Record<string, unknown>).notableFeatures)
              ? ((appearance as Record<string, unknown>).notableFeatures as unknown[]).slice(0, 10)
              : (appearance as Record<string, unknown>).notableFeatures,
          }
        : appearance,
  };
}

function buildVisionMessages(imageDataUrl: string, userHint?: string): ModelMessage[] {
  return [
    {
      role: 'user' as const,
      content: [
        { type: 'image' as const, source: { type: 'url' as const, value: imageDataUrl } },
        ...(userHint?.trim() ? [{ type: 'text' as const, content: `User hint: ${userHint.trim()}` }] : []),
      ],
    },
  ];
}

export interface iCharacterVisionDependencies {
  generateValidatedObject: iGenerateValidatedObject;
  createTextAdapter: typeof createCharacterTextAdapter;
  createStructuredModelOptions: typeof createCharacterStructuredModelOptions;
}

export interface iCharacterVisionService {
  analyzeCharacterImage: (
    request: iCharacterVisionRequest,
    adapterOverride?: AnyTextAdapter,
  ) => Promise<iCharacterImageAnalysis>;
}

export function createCharacterVisionService(
  dependencies: iCharacterVisionDependencies = {
    generateValidatedObject,
    createTextAdapter: createCharacterTextAdapter,
    createStructuredModelOptions: createCharacterStructuredModelOptions,
  },
): iCharacterVisionService {
  return {
    analyzeCharacterImage: async (request, adapterOverride) => {
      const parsedRequest = CHARACTER_VISION_REQUEST_SCHEMA.parse(request);
      const adapter =
        adapterOverride ??
        dependencies.createTextAdapter({
          endpoint: parsedRequest.endpoint,
          apiKey: parsedRequest.apiKey,
          model: parsedRequest.model,
        });
      const messages = buildVisionMessages(parsedRequest.imageDataUrl, parsedRequest.userHint);

      const analysis = await dependencies.generateValidatedObject({
        adapter,
        system: VISION_SYSTEM_PROMPT,
        messages,
        schema: CHARACTER_IMAGE_ANALYSIS_SCHEMA,
        schemaDescription: 'Visible character appearance details with uncertainty and suggested tags.',
        modelOptions: dependencies.createStructuredModelOptions(parsedRequest.endpoint, {
          maxTokens: parsedRequest.maxTokens,
          temperature: parsedRequest.temperature,
          topK: 0,
          minP: 0,
        }),
      });

      return CHARACTER_IMAGE_ANALYSIS_SCHEMA.parse(clampAnalysisArrays(analysis));
    },
  };
}

const DEFAULT_CHARACTER_VISION_SERVICE = createCharacterVisionService();

export async function analyzeCharacterImage(request: iCharacterVisionRequest, adapterOverride?: AnyTextAdapter) {
  return DEFAULT_CHARACTER_VISION_SERVICE.analyzeCharacterImage(request, adapterOverride);
}
