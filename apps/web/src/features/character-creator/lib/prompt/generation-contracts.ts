import { z } from 'zod';

import type { CustomField } from '../card-schema';
import type { TemplateMode } from '../field-templates';

export const GENERATION_MODE_SCHEMA = z.enum(['generate', 'continue', 'rewrite']);
export const GENERATION_MODES = GENERATION_MODE_SCHEMA.enum;
export type GenerationMode = z.infer<typeof GENERATION_MODE_SCHEMA>;

export const GENERATION_TARGET_KIND_SCHEMA = z.enum(['field', 'alternate-greeting', 'custom-field']);
export const GENERATION_TARGET_KINDS = GENERATION_TARGET_KIND_SCHEMA.enum;
export type GenerationTargetKind = z.infer<typeof GENERATION_TARGET_KIND_SCHEMA>;

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

export interface iPromptExampleCharacter {
  name?: string;
  description?: string;
  personality?: string;
  scenario?: string;
  first_mes?: string;
  mes_example?: string;
  alternate_greetings?: string[];
  custom_fields?: CustomField[];
}

export interface iPromptFieldTemplate {
  name: string;
  mode: TemplateMode;
  content: string;
}

export function getGenerationTargetKey(target: iFieldGenerationTarget) {
  return target.key;
}
