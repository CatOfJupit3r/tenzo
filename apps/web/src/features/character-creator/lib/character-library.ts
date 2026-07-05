import { z } from 'zod';

import { createEmptyCharacterCard } from '../constants/card-defaults';
import type { CharacterCard } from './card-schema';
import { CHARACTER_CARD_SCHEMA } from './card-schema';
import {
  CHARACTER_GENERATION_PROMPT_SETTINGS_SCHEMA,
  DEFAULT_CHARACTER_GENERATION_PROMPT_SETTINGS,
  sanitizeCharacterGenerationPromptSettings,
} from './generation-config';
import type { iCharacterGenerationPromptSettings } from './generation-config';
import { sanitizeStoredPortraitCropRect } from './portrait-focal-point';
import type { iPortraitCropRect } from './portrait-focal-point';

export const CHARACTER_LIBRARY_SOURCE_SCHEMA = z.enum(['manual', 'json', 'png']);
export const CHARACTER_LIBRARY_SOURCES = CHARACTER_LIBRARY_SOURCE_SCHEMA.enum;
export type CharacterLibrarySource = z.infer<typeof CHARACTER_LIBRARY_SOURCE_SCHEMA>;

export const DEFAULT_CHARACTER_LIBRARY_ITEM_ID = 'draft-character';

export const PORTRAIT_CROP_RECT_SCHEMA = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

export const CHARACTER_PORTRAIT_REFERENCE_SCHEMA = z.object({
  assetId: z.string(),
  fileName: z.string(),
  mimeType: z.string(),
  cropRect: PORTRAIT_CROP_RECT_SCHEMA.nullable(),
  thumbnailDataUrl: z.string().nullable(),
});

export const CHARACTER_LIBRARY_ITEM_SCHEMA = z.object({
  id: z.string(),
  card: CHARACTER_CARD_SCHEMA,
  promptSettings: CHARACTER_GENERATION_PROMPT_SETTINGS_SCHEMA,
  portrait: CHARACTER_PORTRAIT_REFERENCE_SCHEMA.nullable(),
  source: CHARACTER_LIBRARY_SOURCE_SCHEMA,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type iCharacterPortraitReference = z.infer<typeof CHARACTER_PORTRAIT_REFERENCE_SCHEMA>;

export type iCharacterLibraryItem = z.infer<typeof CHARACTER_LIBRARY_ITEM_SCHEMA>;

function getTimestamp() {
  return new Date().toISOString();
}

function readString(value: unknown, fallbackValue = '') {
  return typeof value === 'string' ? value : fallbackValue;
}

function readTimestamp(value: unknown) {
  return typeof value === 'string' && value.trim() !== '' ? value : getTimestamp();
}

export function sanitizeCharacterPortraitReference(value: unknown): iCharacterPortraitReference | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const assetId = readString(candidate.assetId);
  const fileName = readString(candidate.fileName);
  const mimeType = readString(candidate.mimeType, 'application/octet-stream');
  const thumbnailDataUrl = readString(candidate.thumbnailDataUrl);

  if (assetId.trim() === '' || fileName.trim() === '') {
    return null;
  }

  return {
    assetId,
    fileName,
    mimeType,
    cropRect: sanitizeStoredPortraitCropRect(candidate.cropRect as Partial<iPortraitCropRect> | null | undefined),
    thumbnailDataUrl: thumbnailDataUrl.startsWith('data:') ? thumbnailDataUrl : null,
  };
}

export function createCharacterLibraryItem({
  id,
  card,
  promptSettings = DEFAULT_CHARACTER_GENERATION_PROMPT_SETTINGS,
  portrait = null,
  source = CHARACTER_LIBRARY_SOURCES.manual,
}: {
  id?: string;
  card?: CharacterCard;
  promptSettings?: iCharacterGenerationPromptSettings;
  portrait?: iCharacterPortraitReference | null;
  source?: CharacterLibrarySource;
} = {}): iCharacterLibraryItem {
  const timestamp = getTimestamp();

  return {
    id: id ?? crypto.randomUUID(),
    card: card ?? createEmptyCharacterCard(),
    promptSettings: sanitizeCharacterGenerationPromptSettings(promptSettings),
    portrait,
    source,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function createEmptyCharacterLibraryItem(id = DEFAULT_CHARACTER_LIBRARY_ITEM_ID): iCharacterLibraryItem {
  return createCharacterLibraryItem({ id });
}

export function sanitizeCharacterLibraryItem(value: unknown): iCharacterLibraryItem | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const cardResult = CHARACTER_CARD_SCHEMA.safeParse(candidate.card);
  const id = readString(candidate.id);

  if (!cardResult.success || id.trim() === '') {
    return null;
  }

  return {
    id,
    card: cardResult.data,
    promptSettings: sanitizeCharacterGenerationPromptSettings(candidate.promptSettings),
    portrait: sanitizeCharacterPortraitReference(candidate.portrait),
    source: CHARACTER_LIBRARY_SOURCE_SCHEMA.safeParse(candidate.source).success
      ? (candidate.source as CharacterLibrarySource)
      : CHARACTER_LIBRARY_SOURCES.manual,
    createdAt: readTimestamp(candidate.createdAt),
    updatedAt: readTimestamp(candidate.updatedAt),
  };
}

export function sanitizeCharacterLibrary(value: unknown): iCharacterLibraryItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => sanitizeCharacterLibraryItem(item))
    .filter((item): item is iCharacterLibraryItem => item !== null);
}

function hasTextContent(value: string | undefined) {
  return Boolean(value?.trim());
}

export function hasMeaningfulCharacterCardData(card: CharacterCard) {
  const { data } = card;

  return (
    hasTextContent(data.name) ||
    hasTextContent(data.description) ||
    hasTextContent(data.personality) ||
    hasTextContent(data.scenario) ||
    hasTextContent(data.first_mes) ||
    hasTextContent(data.mes_example) ||
    hasTextContent(data.creator_notes) ||
    hasTextContent(data.system_prompt) ||
    hasTextContent(data.post_history_instructions) ||
    hasTextContent(data.creator) ||
    hasTextContent(data.character_version) ||
    data.tags.length > 0 ||
    data.alternate_greetings.some((greeting) => greeting.trim() !== '') ||
    data.extensions.custom_fields.some((field) => field.label.trim() !== '' || field.value.trim() !== '')
  );
}

export function getCharacterLibraryItemDisplayName(character: iCharacterLibraryItem) {
  const trimmedName = character.card.data.name.trim();

  if (trimmedName !== '') {
    return trimmedName;
  }

  return 'Untitled character';
}

export function createDuplicateCharacterName(name: string) {
  const trimmedName = name.trim();

  if (trimmedName === '') {
    return 'Untitled character copy';
  }

  return `${trimmedName} Copy`;
}

export function getCharacterLibraryItemSummary(character: iCharacterLibraryItem) {
  const { data } = character.card;
  const summarySource =
    data.description.trim() ||
    data.personality.trim() ||
    data.scenario.trim() ||
    data.first_mes.trim() ||
    data.creator_notes.trim();

  if (summarySource === '') {
    return 'Ready for details, dialogue, and portrait work.';
  }

  return summarySource.length > 140 ? `${summarySource.slice(0, 137).trimEnd()}...` : summarySource;
}
