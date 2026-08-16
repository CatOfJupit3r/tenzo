import { z } from 'zod';

import { CUSTOM_FIELD_SCHEMA } from '../cards/card-schema';
import type { TemplateMode } from '../cards/field-templates';

export const GENERATION_MODE_SCHEMA = z.enum(['generate', 'continue', 'rewrite']);
export const GENERATION_MODES = GENERATION_MODE_SCHEMA.enum;
export type GenerationMode = z.infer<typeof GENERATION_MODE_SCHEMA>;

export const GENERATION_TARGET_KIND_SCHEMA = z.enum([
  'field',
  'alternate-greeting',
  'custom-field',
  'general-character-idea',
]);
export const GENERATION_TARGET_KINDS = GENERATION_TARGET_KIND_SCHEMA.enum;
export type GenerationTargetKind = z.infer<typeof GENERATION_TARGET_KIND_SCHEMA>;

export const GENERAL_CHARACTER_IDEA_GENERATION_TARGET_KEY = 'general-character-idea';

export interface iGenerationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface iFieldGenerationTarget {
  key: string;
  label: string;
  value: string;
  kind: GenerationTargetKind;
}

export const PROMPT_EXAMPLE_CHARACTER_SCHEMA = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  personality: z.string().optional(),
  scenario: z.string().optional(),
  first_mes: z.string().optional(),
  mes_example: z.string().optional(),
  alternate_greetings: z.array(z.string()).optional(),
  custom_fields: z.array(CUSTOM_FIELD_SCHEMA).optional(),
});
export type iPromptExampleCharacter = z.infer<typeof PROMPT_EXAMPLE_CHARACTER_SCHEMA>;

export interface iPromptFieldTemplate {
  name: string;
  mode: TemplateMode;
  content: string;
}

export function getGenerationTargetKey(target: iFieldGenerationTarget) {
  return target.key;
}
