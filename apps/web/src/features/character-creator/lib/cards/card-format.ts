import { z } from 'zod';

import { JSON_VALUE_SCHEMA } from '@~/lib/json-value';
import type { iJsonValue } from '@~/lib/json-value';
import { generateUuid } from '@~/utils/uuid';

import { createEmptyCharacterCard } from '../../constants/card-defaults';
import { sanitizeCharacterGenerationPromptSettings } from '../generation/generation-config';
import type { iCharacterGenerationPromptSettings } from '../generation/generation-config';
import {
  PORTRAIT_CROP_RECT_INPUT_SCHEMA,
  sanitizeStoredPortraitCropRect,
} from '../portrait/portrait-focal-point';
import type { iPortraitCropRect } from '../portrait/portrait-focal-point';
import { CHARACTER_BOOK_ENTRY_POSITION_SCHEMA, CHARACTER_CARD_SCHEMA } from './card-schema';
import type { CharacterBook, CharacterBookEntry, CharacterCard, CustomField } from './card-schema';
import { EXPORT_DETAIL_LEVELS } from './export-settings';
import type { ExportDetailLevel } from './export-settings';

export const TENZO_CARD_EXTENSION_KEY = 'tenzo';
export const TENZO_CARD_EXTENSION_VERSION = 1;

const HYBRID_TOP_LEVEL_FIELD_KEYS = [
  'name',
  'description',
  'personality',
  'scenario',
  'first_mes',
  'mes_example',
] as const;

type HybridTopLevelFieldKey = (typeof HYBRID_TOP_LEVEL_FIELD_KEYS)[number];

export interface iHybridCharacterCard extends CharacterCard {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
}

const STRINGABLE_VALUE_SCHEMA = z
  .union([z.string(), z.number(), z.boolean()])
  .transform((value) => String(value))
  .catch('');

const STRING_ARRAY_SCHEMA = z
  .array(STRINGABLE_VALUE_SCHEMA)
  .transform((values) => values.filter((value) => value.length > 0))
  .catch([]);

const CHARACTER_EXTENSIONS_SCHEMA = z.record(z.string(), JSON_VALUE_SCHEMA).catch({});

const CHARACTER_BOOK_ENTRY_IMPORT_SCHEMA = z
  .object({
    keys: STRING_ARRAY_SCHEMA,
    content: STRINGABLE_VALUE_SCHEMA,
    extensions: CHARACTER_EXTENSIONS_SCHEMA,
    enabled: z.boolean().catch(true),
    insertion_order: z.number().finite().catch(0),
    case_sensitive: z.boolean().optional().catch(undefined),
    name: STRINGABLE_VALUE_SCHEMA.optional().catch(undefined),
    priority: z.number().finite().optional().catch(undefined),
    id: z.number().finite().optional().catch(undefined),
    comment: STRINGABLE_VALUE_SCHEMA.optional().catch(undefined),
    selective: z.boolean().optional().catch(undefined),
    secondary_keys: STRING_ARRAY_SCHEMA.optional().catch(undefined),
    constant: z.boolean().optional().catch(undefined),
    position: CHARACTER_BOOK_ENTRY_POSITION_SCHEMA.optional().catch(undefined),
  })
  .catch({
    keys: [],
    content: '',
    extensions: {},
    enabled: true,
    insertion_order: 0,
    case_sensitive: undefined,
    name: undefined,
    priority: undefined,
    id: undefined,
    comment: undefined,
    selective: undefined,
    secondary_keys: undefined,
    constant: undefined,
    position: undefined,
  });

const CHARACTER_BOOK_IMPORT_SCHEMA = z
  .object({
    name: STRINGABLE_VALUE_SCHEMA.optional().catch(undefined),
    description: STRINGABLE_VALUE_SCHEMA.optional().catch(undefined),
    scan_depth: z.number().finite().optional().catch(undefined),
    token_budget: z.number().finite().optional().catch(undefined),
    recursive_scanning: z.boolean().optional().catch(undefined),
    extensions: CHARACTER_EXTENSIONS_SCHEMA,
    entries: z.array(CHARACTER_BOOK_ENTRY_IMPORT_SCHEMA).catch([]),
  })
  .optional()
  .catch(undefined);

const CHARACTER_DATA_IMPORT_SCHEMA = z.object({
  name: STRINGABLE_VALUE_SCHEMA,
  description: STRINGABLE_VALUE_SCHEMA,
  personality: STRINGABLE_VALUE_SCHEMA,
  scenario: STRINGABLE_VALUE_SCHEMA,
  first_mes: STRINGABLE_VALUE_SCHEMA,
  mes_example: STRINGABLE_VALUE_SCHEMA,
  creator_notes: STRINGABLE_VALUE_SCHEMA,
  system_prompt: STRINGABLE_VALUE_SCHEMA,
  post_history_instructions: STRINGABLE_VALUE_SCHEMA,
  alternate_greetings: STRING_ARRAY_SCHEMA,
  character_book: CHARACTER_BOOK_IMPORT_SCHEMA,
  tags: STRING_ARRAY_SCHEMA,
  creator: STRINGABLE_VALUE_SCHEMA,
  character_version: STRINGABLE_VALUE_SCHEMA,
  extensions: CHARACTER_EXTENSIONS_SCHEMA,
});

const EMPTY_CHARACTER_DATA = {
  name: '',
  description: '',
  personality: '',
  scenario: '',
  first_mes: '',
  mes_example: '',
  creator_notes: '',
  system_prompt: '',
  post_history_instructions: '',
  alternate_greetings: [],
  character_book: undefined,
  tags: [],
  creator: '',
  character_version: '',
  extensions: {},
};

const CHARACTER_CARD_V2_IMPORT_SCHEMA = z.object({
  spec: z.literal('chara_card_v2'),
  spec_version: z.literal('2.0'),
  data: CHARACTER_DATA_IMPORT_SCHEMA.catch(EMPTY_CHARACTER_DATA),
});

const CHARACTER_CARD_V1_IMPORT_SCHEMA = CHARACTER_DATA_IMPORT_SCHEMA.extend({
  spec: z.never().optional(),
  spec_version: z.never().optional(),
  data: z.never().optional(),
});

const CHARACTER_CARD_IMPORT_ENVELOPE_SCHEMA = z.union([
  CHARACTER_CARD_V2_IMPORT_SCHEMA.transform(({ data }) => data),
  CHARACTER_CARD_V1_IMPORT_SCHEMA,
]);

const CUSTOM_FIELD_IMPORT_SCHEMA = z
  .object({
    id: z.string().catch(''),
    label: STRINGABLE_VALUE_SCHEMA,
    value: STRINGABLE_VALUE_SCHEMA,
  })
  .optional()
  .catch(undefined);

const TENZO_CARD_EXTENSION_SCHEMA = z
  .object({
    version: z.number().finite().optional().catch(undefined),
    custom_fields: JSON_VALUE_SCHEMA.optional().catch(undefined),
    portrait_crop_rect: PORTRAIT_CROP_RECT_INPUT_SCHEMA.optional(),
    general_character_idea: z.string().optional().catch(undefined),
    field_instructions: JSON_VALUE_SCHEMA.optional().catch(undefined),
    field_should_use_general_character_idea: JSON_VALUE_SCHEMA.optional().catch(undefined),
  })
  .catch({});

function normalizeCharacterBookEntry(source: z.infer<typeof CHARACTER_BOOK_ENTRY_IMPORT_SCHEMA>): CharacterBookEntry {
  return {
    keys: source.keys,
    content: source.content,
    extensions: source.extensions,
    enabled: source.enabled,
    insertion_order: source.insertion_order,
    case_sensitive: source.case_sensitive,
    name: source.name,
    priority: source.priority,
    id: source.id,
    comment: source.comment,
    selective: source.selective,
    secondary_keys: source.secondary_keys,
    constant: source.constant,
    position: source.position,
  };
}

function normalizeCharacterBook(source: z.infer<typeof CHARACTER_BOOK_IMPORT_SCHEMA>): CharacterBook | undefined {
  if (!source) {
    return undefined;
  }

  return {
    name: source.name,
    description: source.description,
    scan_depth: source.scan_depth,
    token_budget: source.token_budget,
    recursive_scanning: source.recursive_scanning,
    extensions: source.extensions,
    entries: source.entries.map(normalizeCharacterBookEntry),
  };
}

function normalizeCustomFields(value: iJsonValue | undefined): CustomField[] {
  const parsed = z.array(CUSTOM_FIELD_IMPORT_SCHEMA).safeParse(value);
  if (!parsed.success) {
    return [];
  }

  return parsed.data.flatMap((field) => {
    if (!field) {
      return [];
    }

    return [
      {
        id: field.id.trim() === '' ? generateUuid() : field.id,
        label: field.label,
        value: field.value,
      },
    ];
  });
}

function parseTenzoCardExtension(value: iJsonValue | undefined) {
  const parsed = TENZO_CARD_EXTENSION_SCHEMA.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function normalizeImportedCharacterCard(value: unknown): CharacterCard {
  const source = CHARACTER_CARD_IMPORT_ENVELOPE_SCHEMA.parse(value);
  const emptyCard = createEmptyCharacterCard();
  const tenzoExtension = parseTenzoCardExtension(source.extensions[TENZO_CARD_EXTENSION_KEY]);
  const passthroughExtensions = Object.fromEntries(
    Object.entries(source.extensions).filter(([key]) => key !== TENZO_CARD_EXTENSION_KEY),
  );

  const normalizedCard: CharacterCard = {
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      ...emptyCard.data,
      name: source.name,
      description: source.description,
      personality: source.personality,
      scenario: source.scenario,
      first_mes: source.first_mes,
      mes_example: source.mes_example,
      creator_notes: source.creator_notes,
      system_prompt: source.system_prompt,
      post_history_instructions: source.post_history_instructions,
      alternate_greetings: source.alternate_greetings,
      character_book: normalizeCharacterBook(source.character_book),
      tags: source.tags,
      creator: source.creator,
      character_version: source.character_version,
      extensions: {
        ...passthroughExtensions,
        custom_fields: normalizeCustomFields(tenzoExtension?.custom_fields ?? source.extensions.custom_fields),
      },
    },
  };

  return CHARACTER_CARD_SCHEMA.parse(normalizedCard);
}

export interface iTenzoCardMetadata {
  cropRect: iPortraitCropRect | null;
  promptSettings: iCharacterGenerationPromptSettings | null;
}

export function extractTenzoCardMetadata(value: unknown): iTenzoCardMetadata {
  const parsedCard = CHARACTER_CARD_IMPORT_ENVELOPE_SCHEMA.safeParse(value);
  if (!parsedCard.success) {
    return { cropRect: null, promptSettings: null };
  }

  const tenzoExtension = parseTenzoCardExtension(parsedCard.data.extensions[TENZO_CARD_EXTENSION_KEY]);
  if (!tenzoExtension) {
    return { cropRect: null, promptSettings: null };
  }

  const hasPromptSettings =
    tenzoExtension.general_character_idea !== undefined ||
    tenzoExtension.field_instructions !== undefined ||
    tenzoExtension.field_should_use_general_character_idea !== undefined;

  return {
    cropRect: sanitizeStoredPortraitCropRect(tenzoExtension.portrait_crop_rect),
    promptSettings: hasPromptSettings
      ? sanitizeCharacterGenerationPromptSettings({
          generalCharacterIdea: tenzoExtension.general_character_idea,
          fieldInstructions: tenzoExtension.field_instructions,
          fieldShouldUseGeneralCharacterIdea: tenzoExtension.field_should_use_general_character_idea,
        })
      : null,
  };
}

export function parseCharacterCardJson(jsonText: string): CharacterCard {
  return normalizeImportedCharacterCard(JSON.parse(jsonText));
}

export function toHybridCharacterCard(card: CharacterCard): iHybridCharacterCard {
  const hybridCard = {
    ...card,
    name: card.data.name,
    description: card.data.description,
    personality: card.data.personality,
    scenario: card.data.scenario,
    first_mes: card.data.first_mes,
    mes_example: card.data.mes_example,
  } satisfies iHybridCharacterCard;

  return hybridCard;
}

export interface iCharacterCardExportOptions {
  detailLevel: ExportDetailLevel;
  promptSettings?: iCharacterGenerationPromptSettings | null;
  portraitCropRect?: iPortraitCropRect | null;
}

export type iExportedCharacterCard = Omit<iHybridCharacterCard, 'data'> & {
  data: Omit<CharacterCard['data'], 'extensions'> & { extensions: Record<string, iJsonValue> };
};

function buildTenzoCardExtension(customFields: CustomField[], options: iCharacterCardExportOptions) {
  const tenzoExtension: Record<string, iJsonValue> = {
    version: TENZO_CARD_EXTENSION_VERSION,
    custom_fields: customFields,
    portrait_crop_rect: options.portraitCropRect
      ? {
          x: options.portraitCropRect.x,
          y: options.portraitCropRect.y,
          width: options.portraitCropRect.width,
          height: options.portraitCropRect.height,
        }
      : null,
    general_character_idea: options.promptSettings?.generalCharacterIdea ?? '',
  };

  if (options.detailLevel === EXPORT_DETAIL_LEVELS.full) {
    tenzoExtension.field_instructions = options.promptSettings?.fieldInstructions ?? {};
    tenzoExtension.field_should_use_general_character_idea =
      options.promptSettings?.fieldShouldUseGeneralCharacterIdea ?? {};
  }

  return tenzoExtension;
}

export function buildExportedCharacterCard(
  card: CharacterCard,
  options: iCharacterCardExportOptions,
): iExportedCharacterCard {
  const hybridCard = toHybridCharacterCard(structuredClone(card));
  const parsedExtensions = CHARACTER_EXTENSIONS_SCHEMA.parse(hybridCard.data.extensions);
  const customFields = normalizeCustomFields(parsedExtensions.custom_fields);
  const passthroughExtensions = Object.fromEntries(
    Object.entries(parsedExtensions).filter(([key]) => key !== 'custom_fields' && key !== TENZO_CARD_EXTENSION_KEY),
  );

  const extensions: Record<string, iJsonValue> =
    options.detailLevel === EXPORT_DETAIL_LEVELS.minimal
      ? passthroughExtensions
      : {
          ...passthroughExtensions,
          [TENZO_CARD_EXTENSION_KEY]: buildTenzoCardExtension(customFields, options),
        };

  return {
    ...hybridCard,
    data: { ...hybridCard.data, extensions },
  };
}

export function serializeCharacterCard(card: CharacterCard, options?: iCharacterCardExportOptions): string {
  const exportedCard = options ? buildExportedCharacterCard(card, options) : toHybridCharacterCard(card);
  return JSON.stringify(exportedCard, null, 2);
}

export function getCharacterCardFileStem(card: CharacterCard): string {
  const rawName = card.data.name.trim();
  if (!rawName) {
    return 'character-card';
  }

  const slug = rawName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'character-card';
}

export const hybridTopLevelFieldKeys = HYBRID_TOP_LEVEL_FIELD_KEYS satisfies readonly HybridTopLevelFieldKey[];
