import z from 'zod';

import type { CharacterTextFieldKey } from '../lib/cards/card-schema';

export const fieldEditorVariantSchema = z.enum(['plain', 'markdown', 'mesExample']);
export const FIELD_EDITOR_VARIANTS = fieldEditorVariantSchema.enum;
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
    key: 'name',
    label: 'Name',
    rows: 1,
    editorVariant: FIELD_EDITOR_VARIANTS.plain,
  },
  {
    key: 'description',
    label: 'Description',
    rows: 8,
    editorVariant: FIELD_EDITOR_VARIANTS.markdown,
  },
  {
    key: 'personality',
    label: 'Personality',
    rows: 4,
    editorVariant: FIELD_EDITOR_VARIANTS.markdown,
  },
  {
    key: 'scenario',
    label: 'Scenario',
    rows: 4,
    editorVariant: FIELD_EDITOR_VARIANTS.markdown,
  },
  {
    key: 'first_mes',
    label: 'First Message',
    rows: 8,
    editorVariant: FIELD_EDITOR_VARIANTS.markdown,
  },
  {
    key: 'mes_example',
    label: 'Example Dialogue',
    rows: 10,
    editorVariant: FIELD_EDITOR_VARIANTS.mesExample,
  },
];

export const PROMPT_OVERRIDE_FIELD_CONFIGS: iCharacterFieldConfig[] = [
  {
    key: 'system_prompt',
    label: 'System Prompt',
    rows: 4,
    hint: 'Replaces the frontend system prompt. Supports the {{original}} placeholder. Leave empty to use the default.',
    editorVariant: FIELD_EDITOR_VARIANTS.markdown,
    doesAllowOriginalMacro: true,
  },
  {
    key: 'post_history_instructions',
    label: 'Post-History Instructions',
    rows: 4,
    hint: 'Replaces the frontend jailbreak/UJB setting. Supports the {{original}} placeholder. Leave empty to use the default.',
    editorVariant: FIELD_EDITOR_VARIANTS.markdown,
    doesAllowOriginalMacro: true,
  },
];

export const METADATA_FIELD_CONFIGS: iCharacterFieldConfig[] = [
  {
    key: 'creator_notes',
    label: 'Creator Notes',
    rows: 4,
    hint: 'Shown to users browsing the card; never used inside prompts.',
    editorVariant: FIELD_EDITOR_VARIANTS.markdown,
  },
  { key: 'creator', label: 'Creator', rows: 1, editorVariant: FIELD_EDITOR_VARIANTS.plain },
  { key: 'character_version', label: 'Version', rows: 1, editorVariant: FIELD_EDITOR_VARIANTS.plain },
];
