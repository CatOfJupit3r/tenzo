import { z } from 'zod';

export const CHARACTER_TEXT_FIELD_KEYS = [
  'name',
  'description',
  'personality',
  'scenario',
  'first_mes',
  'mes_example',
  'creator_notes',
  'system_prompt',
  'post_history_instructions',
  'creator',
  'character_version',
] as const;

export const CHARACTER_TEXT_FIELD_KEY_SCHEMA = z.enum(CHARACTER_TEXT_FIELD_KEYS);
export type CharacterTextFieldKey = z.infer<typeof CHARACTER_TEXT_FIELD_KEY_SCHEMA>;

export const CHARACTER_BOOK_ENTRY_POSITION_SCHEMA = z.enum(['before_char', 'after_char']);
export const CHARACTER_BOOK_ENTRY_POSITIONS = CHARACTER_BOOK_ENTRY_POSITION_SCHEMA.enum;

export const CHARACTER_BOOK_ENTRY_SCHEMA = z.object({
  keys: z.array(z.string()),
  content: z.string(),
  extensions: z.record(z.string(), z.unknown()),
  enabled: z.boolean(),
  insertion_order: z.number(),
  case_sensitive: z.boolean().optional(),
  name: z.string().optional(),
  priority: z.number().optional(),
  id: z.number().optional(),
  comment: z.string().optional(),
  selective: z.boolean().optional(),
  secondary_keys: z.array(z.string()).optional(),
  constant: z.boolean().optional(),
  position: CHARACTER_BOOK_ENTRY_POSITION_SCHEMA.optional(),
});

export const CHARACTER_BOOK_SCHEMA = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  scan_depth: z.number().optional(),
  token_budget: z.number().optional(),
  recursive_scanning: z.boolean().optional(),
  extensions: z.record(z.string(), z.unknown()),
  entries: z.array(CHARACTER_BOOK_ENTRY_SCHEMA),
});

export const CUSTOM_FIELD_SCHEMA = z.object({
  id: z.string(),
  label: z.string(),
  value: z.string(),
});

export const CHARACTER_DATA_EXTENSIONS_SCHEMA = z
  .object({
    custom_fields: z.array(CUSTOM_FIELD_SCHEMA).default([]),
  })
  .catchall(z.unknown());

export const CHARACTER_DATA_SCHEMA = z.object({
  name: z.string(),
  description: z.string(),
  personality: z.string(),
  scenario: z.string(),
  first_mes: z.string(),
  mes_example: z.string(),
  creator_notes: z.string(),
  system_prompt: z.string(),
  post_history_instructions: z.string(),
  alternate_greetings: z.array(z.string()),
  character_book: CHARACTER_BOOK_SCHEMA.optional(),
  tags: z.array(z.string()),
  creator: z.string(),
  character_version: z.string(),
  extensions: CHARACTER_DATA_EXTENSIONS_SCHEMA,
});

export const CHARACTER_CARD_SCHEMA = z.object({
  spec: z.literal('chara_card_v2'),
  spec_version: z.literal('2.0'),
  data: CHARACTER_DATA_SCHEMA,
});

export type CharacterBookEntry = z.infer<typeof CHARACTER_BOOK_ENTRY_SCHEMA>;
export type CharacterBook = z.infer<typeof CHARACTER_BOOK_SCHEMA>;
export type CustomField = z.infer<typeof CUSTOM_FIELD_SCHEMA>;
export type CharacterData = z.infer<typeof CHARACTER_DATA_SCHEMA>;
export type CharacterCard = z.infer<typeof CHARACTER_CARD_SCHEMA>;
