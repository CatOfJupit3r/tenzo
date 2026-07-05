import { localStorageApi } from '@~/db/storage';

import { characterLibraryCollection } from '../collections/character-library.collection';
import { exampleCharactersCollection } from '../collections/example-characters.collection';
import {
  CHARACTER_LIBRARY_SOURCES,
  createEmptyCharacterLibraryItem,
  DEFAULT_CHARACTER_LIBRARY_ITEM_ID,
  hasMeaningfulCharacterCardData,
  sanitizeCharacterLibrary,
  sanitizeCharacterPortraitReference,
} from './character-library';
import type { iCharacterLibraryItem } from './character-library';
import { STORED_EXAMPLE_CHARACTER_SCHEMA } from './example-characters';
import type { iStoredExampleCharacter } from './example-characters';
import { sanitizeCharacterGenerationPromptSettings, sanitizeCharacterGenerationSettings } from './generation-config';

const MIGRATION_FLAG_KEY = 'tenzo:character-creator:migrated:v2';
const LEGACY_LIBRARY_KEY = 'tenzo:character-creator:library';
const LEGACY_EXAMPLES_KEY = 'tenzo:character-creator:example-characters';
const LEGACY_CARD_KEY = 'tenzo:character-creator:card';
const LEGACY_PORTRAIT_KEY = 'tenzo:character-creator:portrait';
const LEGACY_GENERATION_SETTINGS_KEY = 'tenzo:character-creator:generation-settings';

const LEGACY_KEYS_TO_REMOVE = [
  LEGACY_LIBRARY_KEY,
  LEGACY_EXAMPLES_KEY,
  LEGACY_CARD_KEY,
  LEGACY_PORTRAIT_KEY,
  LEGACY_GENERATION_SETTINGS_KEY,
];

let hasRunMigration = false;

function parseStoredJsonValue(value: string | null): unknown {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function migrateLegacyCharacterLibraryItem(): iCharacterLibraryItem | null {
  const legacyCardValue = parseStoredJsonValue(localStorageApi.getItem(LEGACY_CARD_KEY));
  const legacyPortraitValue = parseStoredJsonValue(localStorageApi.getItem(LEGACY_PORTRAIT_KEY));
  const legacyGenerationSettings = sanitizeCharacterGenerationSettings(
    parseStoredJsonValue(localStorageApi.getItem(LEGACY_GENERATION_SETTINGS_KEY)),
  );

  if (!legacyCardValue || typeof legacyCardValue !== 'object') {
    return null;
  }

  const [migratedCharacter] = sanitizeCharacterLibrary([
    {
      id: DEFAULT_CHARACTER_LIBRARY_ITEM_ID,
      card: legacyCardValue,
      portrait: sanitizeCharacterPortraitReference(legacyPortraitValue),
      promptSettings: sanitizeCharacterGenerationPromptSettings(legacyGenerationSettings),
      source: CHARACTER_LIBRARY_SOURCES.manual,
    },
  ]);

  if (!migratedCharacter) {
    return null;
  }

  if (!hasMeaningfulCharacterCardData(migratedCharacter.card) && migratedCharacter.portrait === null) {
    return null;
  }

  return migratedCharacter;
}

function migrateLibraryFromLegacy() {
  if (characterLibraryCollection.size > 0) {
    return;
  }

  const legacyLibrary = sanitizeCharacterLibrary(parseStoredJsonValue(localStorageApi.getItem(LEGACY_LIBRARY_KEY)));
  const legacyItem = migrateLegacyCharacterLibraryItem();

  let migratedItems: iCharacterLibraryItem[] = [];
  if (legacyLibrary.length > 0) {
    migratedItems = legacyLibrary;
  } else if (legacyItem) {
    migratedItems = [legacyItem];
  }

  migratedItems.forEach((item) => {
    if (!characterLibraryCollection.has(item.id)) {
      characterLibraryCollection.insert(item);
    }
  });
}

function migrateExamplesFromLegacy() {
  if (exampleCharactersCollection.size > 0) {
    return;
  }

  const legacyExamples = parseStoredJsonValue(localStorageApi.getItem(LEGACY_EXAMPLES_KEY));

  if (!Array.isArray(legacyExamples)) {
    return;
  }

  legacyExamples.forEach((value) => {
    const result = STORED_EXAMPLE_CHARACTER_SCHEMA.safeParse(value);

    if (result.success && !exampleCharactersCollection.has(result.data.id)) {
      exampleCharactersCollection.insert(result.data as iStoredExampleCharacter);
    }
  });
}

/**
 * One-time move of character library and example data from the previous jotai
 * `localStorage` atoms (and the earlier single-card layout) into TanStack DB
 * collections. Idempotent; safe to call on every mount.
 */
export function ensureCharacterCreatorDataMigrated() {
  if (hasRunMigration) {
    return;
  }

  hasRunMigration = true;

  if (localStorageApi.getItem(MIGRATION_FLAG_KEY)) {
    return;
  }

  try {
    migrateLibraryFromLegacy();
    migrateExamplesFromLegacy();
  } finally {
    localStorageApi.setItem(MIGRATION_FLAG_KEY, '1');
    LEGACY_KEYS_TO_REMOVE.forEach((key) => localStorageApi.removeItem(key));
  }
}

/**
 * Runs the one-time migration and guarantees the library always has at least one
 * editable entry.
 */
export function ensureCharacterCreatorSessionInitialized() {
  ensureCharacterCreatorDataMigrated();

  if (characterLibraryCollection.size === 0) {
    characterLibraryCollection.insert(createEmptyCharacterLibraryItem());
  }
}
