import { em } from 'enumwaii';
import z from 'zod';

import { CHARACTER_TEXT_FIELD_KEY } from '@~/features/character-creator/lib/cards/card-schema';

import type { CharacterTextFieldKey } from '../lib/cards/card-schema';

export const fieldEditorVariantEnum = em(['PLAIN', 'MARKDOWN', 'MES_EXAMPLE']);
export const FIELD_EDITOR_VARIANTS = fieldEditorVariantEnum.enum;
export const fieldEditorVariantSchema = z.enum(FIELD_EDITOR_VARIANTS);

export type FieldEditorVariant = z.infer<typeof fieldEditorVariantSchema>;

export interface iCharacterFieldConfig {
  key: CharacterTextFieldKey;
  label: string;
  rows: number;
  hint?: string;
  editorVariant: FieldEditorVariant;
  doesAllowOriginalMacro?: boolean;
}

export const CORE_FIELD_CONFIGS: iCharacterFieldConfig[] = [
  {
    key: CHARACTER_TEXT_FIELD_KEY.NAME,
    label: 'Name',
    rows: 1,
    editorVariant: FIELD_EDITOR_VARIANTS.PLAIN,
  },
  {
    key: CHARACTER_TEXT_FIELD_KEY.DESCRIPTION,
    label: 'Description',
    rows: 8,
    editorVariant: FIELD_EDITOR_VARIANTS.MARKDOWN,
  },
  {
    key: CHARACTER_TEXT_FIELD_KEY.PERSONALITY,
    label: 'Personality',
    rows: 4,
    editorVariant: FIELD_EDITOR_VARIANTS.MARKDOWN,
  },
  {
    key: CHARACTER_TEXT_FIELD_KEY.SCENARIO,
    label: 'Scenario',
    rows: 4,
    editorVariant: FIELD_EDITOR_VARIANTS.MARKDOWN,
  },
  {
    key: CHARACTER_TEXT_FIELD_KEY.FIRST_MES,
    label: 'First Message',
    rows: 8,
    editorVariant: FIELD_EDITOR_VARIANTS.MARKDOWN,
  },
  {
    key: CHARACTER_TEXT_FIELD_KEY.MES_EXAMPLE,
    label: 'Example Dialogue',
    rows: 10,
    editorVariant: FIELD_EDITOR_VARIANTS.MES_EXAMPLE,
  },
];

export const PROMPT_OVERRIDE_FIELD_CONFIGS: iCharacterFieldConfig[] = [
  {
    key: CHARACTER_TEXT_FIELD_KEY.SYSTEM_PROMPT,
    label: 'System Prompt',
    rows: 4,
    hint: 'Replaces the frontend system prompt. Supports the {{original}} placeholder. Leave empty to use the default.',
    editorVariant: FIELD_EDITOR_VARIANTS.MARKDOWN,
    doesAllowOriginalMacro: true,
  },
  {
    key: CHARACTER_TEXT_FIELD_KEY.POST_HISTORY_INSTRUCTIONS,
    label: 'Post-History Instructions',
    rows: 4,
    hint: 'Replaces the frontend jailbreak/UJB setting. Supports the {{original}} placeholder. Leave empty to use the default.',
    editorVariant: FIELD_EDITOR_VARIANTS.MARKDOWN,
    doesAllowOriginalMacro: true,
  },
];

export const METADATA_FIELD_CONFIGS: iCharacterFieldConfig[] = [
  {
    key: CHARACTER_TEXT_FIELD_KEY.CREATOR_NOTES,
    label: 'Creator Notes',
    rows: 4,
    hint: 'Shown to users browsing the card; never used inside prompts.',
    editorVariant: FIELD_EDITOR_VARIANTS.MARKDOWN,
  },
  { key: CHARACTER_TEXT_FIELD_KEY.CREATOR, label: 'Creator', rows: 1, editorVariant: FIELD_EDITOR_VARIANTS.PLAIN },
  {
    key: CHARACTER_TEXT_FIELD_KEY.CHARACTER_VERSION,
    label: 'Version',
    rows: 1,
    editorVariant: FIELD_EDITOR_VARIANTS.PLAIN,
  },
];
