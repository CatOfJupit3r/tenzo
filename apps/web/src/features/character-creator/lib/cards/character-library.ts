import { z } from 'zod';

import { generateUuid } from '@~/utils/uuid';

import { createEmptyCharacterCard } from '../../constants/card-defaults';
import {
  CHARACTER_GENERATION_PROMPT_SETTINGS_STORAGE_SCHEMA,
  CHARACTER_GENERATION_PROMPT_SETTINGS_SCHEMA,
  DEFAULT_CHARACTER_GENERATION_PROMPT_SETTINGS,
  sanitizeCharacterGenerationPromptSettings,
} from '../generation/generation-config';
import type { iCharacterGenerationPromptSettings } from '../generation/generation-config';
import {
  PORTRAIT_CROP_RECT_INPUT_SCHEMA,
  sanitizeStoredPortraitCropRect,
} from '../portrait/portrait-focal-point';
import type { CharacterCard } from './card-schema';
import { CHARACTER_CARD_SCHEMA } from './card-schema';

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

const PORTRAIT_REFERENCE_INPUT_SCHEMA = z
  .object({
    assetId: z.string().catch(''),
    fileName: z.string().catch(''),
    mimeType: z.string().catch('application/octet-stream'),
    cropRect: PORTRAIT_CROP_RECT_INPUT_SCHEMA,
    thumbnailDataUrl: z.string().catch(''),
  })
  .catch({
    assetId: '',
    fileName: '',
    mimeType: 'application/octet-stream',
    cropRect: null,
    thumbnailDataUrl: '',
  })
  .transform((candidate) => {
    if (candidate.assetId.trim() === '' || candidate.fileName.trim() === '') {
      return null;
    }

    return {
      assetId: candidate.assetId,
      fileName: candidate.fileName,
      mimeType: candidate.mimeType,
      cropRect: sanitizeStoredPortraitCropRect(candidate.cropRect),
      thumbnailDataUrl: candidate.thumbnailDataUrl.startsWith('data:') ? candidate.thumbnailDataUrl : null,
    };
  });

function createStoredCharacterLibraryItemSchema(fallbackTimestamp: string) {
  return z.object({
    id: z.string().catch(''),
    card: CHARACTER_CARD_SCHEMA.optional().catch(undefined),
    promptSettings: CHARACTER_GENERATION_PROMPT_SETTINGS_STORAGE_SCHEMA,
    portrait: PORTRAIT_REFERENCE_INPUT_SCHEMA.nullable().catch(null),
    source: CHARACTER_LIBRARY_SOURCE_SCHEMA.catch(CHARACTER_LIBRARY_SOURCES.manual),
    createdAt: z
      .string()
      .refine((value) => value.trim() !== '')
      .catch(fallbackTimestamp),
    updatedAt: z
      .string()
      .refine((value) => value.trim() !== '')
      .catch(fallbackTimestamp),
  });
}

export function sanitizeCharacterPortraitReference(value: unknown): iCharacterPortraitReference | null {
  return PORTRAIT_REFERENCE_INPUT_SCHEMA.parse(value);
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
    id: id ?? generateUuid(),
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

export function sanitizeCharacterLibraryItem(
  value: unknown,
  fallbackTimestamp = getTimestamp(),
): iCharacterLibraryItem | null {
  const parsed = createStoredCharacterLibraryItemSchema(fallbackTimestamp).safeParse(value);

  if (!parsed.success || !parsed.data.card || parsed.data.id.trim() === '') {
    return null;
  }

  return {
    id: parsed.data.id,
    card: parsed.data.card,
    promptSettings: parsed.data.promptSettings,
    portrait: parsed.data.portrait,
    source: parsed.data.source,
    createdAt: parsed.data.createdAt,
    updatedAt: parsed.data.updatedAt,
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
  const summarySource = character.card.data.description.trim().replace(/\s+/g, ' ');

  if (summarySource === '') {
    return 'Ready for details, dialogue, and portrait work.';
  }

  return summarySource.length > 140 ? `${summarySource.slice(0, 137).trimEnd()}...` : summarySource;
}
