import { z } from 'zod';

import { CHARACTER_ASSISTANT_GENERATION_MODE_SCHEMA } from '../assistant/character-assistant-generation-mode';
import {
  FREQUENCY_PENALTY_RANGE,
  MIN_P_RANGE,
  OUTPUT_FORMAT_SCHEMA,
  PRESENCE_PENALTY_RANGE,
  TEMPERATURE_RANGE,
  TOP_K_RANGE,
  TOP_P_RANGE,
} from './generation-config';
import type { iCharacterGenerationConnectionSettings } from './generation-config';

export const GENERATION_PRESET_SETTINGS_SCHEMA = z.object({
  model: z.string(),
  visionModel: z.string(),
  contextSize: z.number().int().positive(),
  maxTokens: z.number().int().positive(),
  outputFormat: OUTPUT_FORMAT_SCHEMA,
  assistantGenerationMode: CHARACTER_ASSISTANT_GENERATION_MODE_SCHEMA,
  temperature: z.number().min(TEMPERATURE_RANGE.min).max(TEMPERATURE_RANGE.max),
  topP: z.number().min(TOP_P_RANGE.min).max(TOP_P_RANGE.max),
  frequencyPenalty: z.number().min(FREQUENCY_PENALTY_RANGE.min).max(FREQUENCY_PENALTY_RANGE.max),
  presencePenalty: z.number().min(PRESENCE_PENALTY_RANGE.min).max(PRESENCE_PENALTY_RANGE.max),
  topK: z.number().int().min(TOP_K_RANGE.min).max(TOP_K_RANGE.max),
  minP: z.number().min(MIN_P_RANGE.min).max(MIN_P_RANGE.max),
});

export type iGenerationPresetSettings = z.infer<typeof GENERATION_PRESET_SETTINGS_SCHEMA>;

export const GENERATION_PRESET_SCHEMA = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  settings: GENERATION_PRESET_SETTINGS_SCHEMA,
});

export type iGenerationPreset = z.infer<typeof GENERATION_PRESET_SCHEMA>;

export function createGenerationPresetSettings(
  settings: iCharacterGenerationConnectionSettings,
): iGenerationPresetSettings {
  return {
    model: settings.model,
    visionModel: settings.visionModel,
    contextSize: settings.contextSize,
    maxTokens: settings.maxTokens,
    outputFormat: settings.outputFormat,
    assistantGenerationMode: settings.assistantGenerationMode,
    temperature: settings.temperature,
    topP: settings.topP,
    frequencyPenalty: settings.frequencyPenalty,
    presencePenalty: settings.presencePenalty,
    topK: settings.topK,
    minP: settings.minP,
  };
}

export function sanitizeGenerationPresets(value: unknown): iGenerationPreset[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((candidate) => {
    const result = GENERATION_PRESET_SCHEMA.safeParse(candidate);
    return result.success ? [result.data] : [];
  });
}
