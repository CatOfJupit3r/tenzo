import type { LanguageModel } from 'ai';

import { createCharacterLanguageModel } from './ai-sdk-text-generation';
import { CHARACTER_IMAGE_ANALYSIS_SCHEMA, CHARACTER_VISION_REQUEST_SCHEMA } from './character-vision-contracts';
import type { iCharacterImageAnalysis, iCharacterVisionRequest } from './character-vision-contracts';
import { generateValidatedObject } from './structured-output.server';

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

function buildVisionMessages(imageDataUrl: string, userHint?: string) {
  return [
    {
      role: 'user' as const,
      content: [
        { type: 'image' as const, image: imageDataUrl },
        ...(userHint?.trim() ? [{ type: 'text' as const, text: `User hint: ${userHint.trim()}` }] : []),
      ],
    },
  ];
}

export async function analyzeCharacterImage(
  request: iCharacterVisionRequest,
  modelOverride?: Exclude<LanguageModel, string>,
): Promise<iCharacterImageAnalysis> {
  const parsedRequest = CHARACTER_VISION_REQUEST_SCHEMA.parse(request);
  const model =
    modelOverride ??
    createCharacterLanguageModel({
      endpoint: parsedRequest.endpoint,
      apiKey: parsedRequest.apiKey,
      model: parsedRequest.model,
      topK: 0,
      minP: 0,
    });
  const messages = buildVisionMessages(parsedRequest.imageDataUrl, parsedRequest.userHint);

  const analysis = await generateValidatedObject({
    model,
    system: VISION_SYSTEM_PROMPT,
    messages,
    schema: CHARACTER_IMAGE_ANALYSIS_SCHEMA,
    schemaName: 'character_image_analysis',
    schemaDescription: 'Visible character appearance details with uncertainty and suggested tags.',
    maxOutputTokens: Math.max(1, Math.floor(parsedRequest.maxTokens)),
    temperature: parsedRequest.temperature,
  });

  return CHARACTER_IMAGE_ANALYSIS_SCHEMA.parse(clampAnalysisArrays(analysis));
}
