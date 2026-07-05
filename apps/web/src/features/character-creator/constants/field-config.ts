import type { CharacterTextFieldKey } from '../lib/card-schema';

export interface iCharacterFieldConfig {
  key: CharacterTextFieldKey;
  label: string;
  rows: number;
  hint?: string;
}

export const CORE_FIELD_CONFIGS: iCharacterFieldConfig[] = [
  {
    key: 'description',
    label: 'Description',
    rows: 8,
    hint: 'Appearance, background, and defining traits. Supports {{char}} and {{user}} macros.',
  },
  {
    key: 'personality',
    label: 'Personality',
    rows: 4,
    hint: 'A short summary of temperament and mannerisms.',
  },
  {
    key: 'scenario',
    label: 'Scenario',
    rows: 4,
    hint: 'The setting or circumstances the roleplay begins in.',
  },
  {
    key: 'first_mes',
    label: 'First Message',
    rows: 8,
    hint: 'The greeting shown when a new chat starts.',
  },
  {
    key: 'mes_example',
    label: 'Example Dialogue',
    rows: 10,
    hint: 'Sample exchanges demonstrating voice and style. Use {{char}} and {{user}} macros.',
  },
];

export const PROMPT_OVERRIDE_FIELD_CONFIGS: iCharacterFieldConfig[] = [
  {
    key: 'system_prompt',
    label: 'System Prompt',
    rows: 4,
    hint: 'Replaces the frontend system prompt. Supports the {{original}} placeholder. Leave empty to use the default.',
  },
  {
    key: 'post_history_instructions',
    label: 'Post-History Instructions',
    rows: 4,
    hint: 'Replaces the frontend jailbreak/UJB setting. Supports the {{original}} placeholder. Leave empty to use the default.',
  },
];

export const METADATA_FIELD_CONFIGS: iCharacterFieldConfig[] = [
  {
    key: 'creator_notes',
    label: 'Creator Notes',
    rows: 4,
    hint: 'Shown to users browsing the card; never used inside prompts.',
  },
  { key: 'creator', label: 'Creator', rows: 1 },
  { key: 'character_version', label: 'Version', rows: 1 },
];
