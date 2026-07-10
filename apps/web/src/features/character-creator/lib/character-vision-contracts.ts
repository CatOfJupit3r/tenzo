import { z } from 'zod';

import { CHARACTER_GENERATION_STREAM_REQUEST_SCHEMA } from './generation-stream-contracts';

const CHARACTER_VISION_DATA_URL_MAX_LENGTH = 3_000_000;

export const CHARACTER_VISION_REQUEST_SCHEMA = CHARACTER_GENERATION_STREAM_REQUEST_SCHEMA.pick({
  endpoint: true,
  apiKey: true,
  model: true,
  maxTokens: true,
  temperature: true,
}).extend({
  imageDataUrl: z
    .string()
    .max(CHARACTER_VISION_DATA_URL_MAX_LENGTH)
    .regex(/^data:image\/(png|jpeg|webp);base64,/),
  userHint: z.string().max(500).optional(),
});

export const CHARACTER_IMAGE_ANALYSIS_SCHEMA = z.object({
  subject: z.string(),
  appearance: z.object({
    hair: z.string(),
    eyes: z.string(),
    skin: z.string(),
    build: z.string(),
    age: z.string(),
    notableFeatures: z.array(z.string()).max(10),
  }),
  attire: z.string(),
  moodAndPose: z.string(),
  artStyle: z.string(),
  paletteAndLighting: z.string(),
  suggestedTags: z.array(z.string()).max(10),
  confidence: z.number().min(0).max(1),
  warnings: z.array(z.string()).max(10),
});

export const CHARACTER_VISION_RESPONSE_SCHEMA = z.object({
  analysis: CHARACTER_IMAGE_ANALYSIS_SCHEMA,
});

export type iCharacterVisionRequest = z.infer<typeof CHARACTER_VISION_REQUEST_SCHEMA>;
export type iCharacterImageAnalysis = z.infer<typeof CHARACTER_IMAGE_ANALYSIS_SCHEMA>;

export function formatImageAnalysisAsAttachmentContent(analysis: iCharacterImageAnalysis) {
  const appearance = [
    ['Hair', analysis.appearance.hair],
    ['Eyes', analysis.appearance.eyes],
    ['Skin', analysis.appearance.skin],
    ['Build', analysis.appearance.build],
    ['Age', analysis.appearance.age],
  ]
    .filter(([, value]) => value.trim())
    .map(([label, value]) => `- ${label}: ${value}`);
  const notableFeatures = analysis.appearance.notableFeatures.filter(Boolean).map((feature) => `- ${feature}`);

  return [
    `Subject: ${analysis.subject}`,
    appearance.length > 0 ? ['Appearance:', ...appearance].join('\n') : null,
    notableFeatures.length > 0 ? ['Notable features:', ...notableFeatures].join('\n') : null,
    analysis.attire.trim() ? `Attire: ${analysis.attire}` : null,
    analysis.moodAndPose.trim() ? `Mood and pose: ${analysis.moodAndPose}` : null,
    analysis.artStyle.trim() ? `Art style: ${analysis.artStyle}` : null,
    analysis.paletteAndLighting.trim() ? `Palette and lighting: ${analysis.paletteAndLighting}` : null,
    analysis.suggestedTags.length > 0 ? `Suggested tags: ${analysis.suggestedTags.join(', ')}` : null,
  ]
    .filter((section): section is string => Boolean(section))
    .join('\n\n');
}
