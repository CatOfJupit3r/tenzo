import { createEmptyCharacterCard } from '../constants/card-defaults';
import { CHARACTER_BOOK_ENTRY_POSITION_SCHEMA, CHARACTER_CARD_SCHEMA } from './card-schema';
import type { CharacterBook, CharacterBookEntry, CharacterCard } from './card-schema';

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toOptionalString(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return '';
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => toOptionalString(item)).filter((item) => item.length > 0);
}

function normalizeCharacterBookEntry(value: unknown): CharacterBookEntry {
  const source = isRecord(value) ? value : {};
  const { position } = source;
  const parsedPosition = CHARACTER_BOOK_ENTRY_POSITION_SCHEMA.safeParse(position);

  return {
    keys: toStringArray(source.keys),
    content: toOptionalString(source.content),
    extensions: isRecord(source.extensions) ? source.extensions : {},
    enabled: typeof source.enabled === 'boolean' ? source.enabled : true,
    insertion_order: typeof source.insertion_order === 'number' ? source.insertion_order : 0,
    case_sensitive: typeof source.case_sensitive === 'boolean' ? source.case_sensitive : undefined,
    name: source.name === undefined ? undefined : toOptionalString(source.name),
    priority: typeof source.priority === 'number' ? source.priority : undefined,
    id: typeof source.id === 'number' ? source.id : undefined,
    comment: source.comment === undefined ? undefined : toOptionalString(source.comment),
    selective: typeof source.selective === 'boolean' ? source.selective : undefined,
    secondary_keys: source.secondary_keys === undefined ? undefined : toStringArray(source.secondary_keys),
    constant: typeof source.constant === 'boolean' ? source.constant : undefined,
    position: parsedPosition.success ? parsedPosition.data : undefined,
  };
}

function normalizeCharacterBook(value: unknown): CharacterBook | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    name: value.name === undefined ? undefined : toOptionalString(value.name),
    description: value.description === undefined ? undefined : toOptionalString(value.description),
    scan_depth: typeof value.scan_depth === 'number' ? value.scan_depth : undefined,
    token_budget: typeof value.token_budget === 'number' ? value.token_budget : undefined,
    recursive_scanning: typeof value.recursive_scanning === 'boolean' ? value.recursive_scanning : undefined,
    extensions: isRecord(value.extensions) ? value.extensions : {},
    entries: Array.isArray(value.entries) ? value.entries.map(normalizeCharacterBookEntry) : [],
  };
}

export function normalizeImportedCharacterCard(value: unknown): CharacterCard {
  const emptyCard = createEmptyCharacterCard();
  const source = isRecord(value) ? value : {};
  const rawData = isRecord(source.data) ? source.data : source;

  const normalizedCard: CharacterCard = {
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      ...emptyCard.data,
      name: toOptionalString(rawData.name),
      description: toOptionalString(rawData.description),
      personality: toOptionalString(rawData.personality),
      scenario: toOptionalString(rawData.scenario),
      first_mes: toOptionalString(rawData.first_mes),
      mes_example: toOptionalString(rawData.mes_example),
      creator_notes: toOptionalString(rawData.creator_notes),
      system_prompt: toOptionalString(rawData.system_prompt),
      post_history_instructions: toOptionalString(rawData.post_history_instructions),
      alternate_greetings: Array.isArray(rawData.alternate_greetings)
        ? rawData.alternate_greetings.map((item) => toOptionalString(item))
        : [],
      character_book: normalizeCharacterBook(rawData.character_book),
      tags: toStringArray(rawData.tags),
      creator: toOptionalString(rawData.creator),
      character_version: toOptionalString(rawData.character_version),
      extensions: {
        custom_fields: [],
        ...(isRecord(rawData.extensions) ? rawData.extensions : {}),
      },
    },
  };

  return CHARACTER_CARD_SCHEMA.parse(normalizedCard);
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

export function serializeCharacterCard(card: CharacterCard): string {
  return JSON.stringify(toHybridCharacterCard(card), null, 2);
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
