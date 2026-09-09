import { em } from 'enumwaii';
import { z } from 'zod';

import { CHARACTER_CARD_SPECS, CHARACTER_CARD_SPEC_VERSIONS } from './card-file-enums';

export const CHARACTER_FIELD_KEY_ENUM = em({
  NAME: 'name',
  DESCRIPTION: 'description',
  PERSONALITY: 'personality',
  SCENARIO: 'scenario',
  FIRST_MES: 'first_mes',
  MES_EXAMPLE: 'mes_example',
  CREATOR_NOTES: 'creator_notes',
  SYSTEM_PROMPT: 'system_prompt',
  POST_HISTORY_INSTRUCTIONS: 'post_history_instructions',
  CREATOR: 'creator',
  CHARACTER_VERSION: 'character_version',
  TAGS: 'tags',
  ALTERNATE_GREETINGS: 'alternate_greetings',
  CUSTOM_FIELDS: 'custom_fields',
  CHARACTER_BOOK: 'character_book',
  ALTERNATE_GREETING: 'alternate_greeting',
  CUSTOM_FIELD: 'custom_field',
});
export const CHARACTER_FIELD_KEYS = CHARACTER_FIELD_KEY_ENUM.enum;

export const CHARACTER_TEXT_FIELD_KEY_ENUM = CHARACTER_FIELD_KEY_ENUM.pick([
  CHARACTER_FIELD_KEYS.NAME,
  CHARACTER_FIELD_KEYS.DESCRIPTION,
  CHARACTER_FIELD_KEYS.PERSONALITY,
  CHARACTER_FIELD_KEYS.SCENARIO,
  CHARACTER_FIELD_KEYS.FIRST_MES,
  CHARACTER_FIELD_KEYS.MES_EXAMPLE,
  CHARACTER_FIELD_KEYS.CREATOR_NOTES,
  CHARACTER_FIELD_KEYS.SYSTEM_PROMPT,
  CHARACTER_FIELD_KEYS.POST_HISTORY_INSTRUCTIONS,
  CHARACTER_FIELD_KEYS.CREATOR,
  CHARACTER_FIELD_KEYS.CHARACTER_VERSION,
]);
export const CHARACTER_TEXT_FIELD_KEY = CHARACTER_TEXT_FIELD_KEY_ENUM.rawEnum;
export const CHARACTER_TEXT_FIELD_KEYS = CHARACTER_TEXT_FIELD_KEY_ENUM.rawValues;

export const CHARACTER_TEXT_FIELD_KEY_SCHEMA = z.enum(CHARACTER_TEXT_FIELD_KEY);
export type CharacterTextFieldKey = z.infer<typeof CHARACTER_TEXT_FIELD_KEY_SCHEMA>;

export const CHARACTER_BOOK_ENTRY_POSITION_ENUM = em({
  BEFORE_CHAR: 'before_char',
  AFTER_CHAR: 'after_char',
});
export const CHARACTER_BOOK_ENTRY_POSITIONS = CHARACTER_BOOK_ENTRY_POSITION_ENUM.enum;
export const CHARACTER_BOOK_ENTRY_POSITION_SCHEMA = z.enum(CHARACTER_BOOK_ENTRY_POSITIONS);

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
  spec: z.literal(CHARACTER_CARD_SPECS.CHARA_CARD_V2),
  spec_version: z.literal(CHARACTER_CARD_SPEC_VERSIONS.VALUE_2_0),
  data: CHARACTER_DATA_SCHEMA,
});

export type CharacterBookEntry = z.infer<typeof CHARACTER_BOOK_ENTRY_SCHEMA>;
export type CharacterBook = z.infer<typeof CHARACTER_BOOK_SCHEMA>;
export type CustomField = z.infer<typeof CUSTOM_FIELD_SCHEMA>;
export type CharacterData = z.infer<typeof CHARACTER_DATA_SCHEMA>;
export type CharacterCard = z.infer<typeof CHARACTER_CARD_SCHEMA>;
