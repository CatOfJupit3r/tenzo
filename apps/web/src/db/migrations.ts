import type { Transaction } from 'dexie';
import type { z } from 'zod';

import {
  CHARACTER_ASSISTANT_COMPOSER_DRAFT_SCHEMA,
  CHARACTER_ASSISTANT_COMPOSER_DRAFTS_STORAGE_KEY,
} from '../features/character-creator/collections/character-assistant-composer-drafts.collection';
import {
  CHARACTER_ASSISTANT_SESSIONS_COLLECTION_STORAGE_KEY,
  LEGACY_CHARACTER_AGENT_SESSION_STORAGE_KEYS,
} from '../features/character-creator/collections/character-assistant-sessions.collection';
import { CHARACTER_LIBRARY_COLLECTION_STORAGE_KEY } from '../features/character-creator/collections/character-library.collection';
import { EXAMPLE_CHARACTERS_COLLECTION_STORAGE_KEY } from '../features/character-creator/collections/example-characters.collection';
import { FIELD_TEMPLATES_COLLECTION_STORAGE_KEY } from '../features/character-creator/collections/field-templates.collection';
import {
  readStoredCollectionItems,
  selectLatestSessions,
} from '../features/character-creator/lib/assistant/character-assistant-session-storage';
import { createArchiveBlob } from '../features/character-creator/lib/cards/archive';
import { buildFullBackupFiles } from '../features/character-creator/lib/cards/backup';
import type { iBackupPortraitAsset } from '../features/character-creator/lib/cards/backup';
import {
  CHARACTER_LIBRARY_SOURCES,
  DEFAULT_CHARACTER_LIBRARY_ITEM_ID,
  hasMeaningfulCharacterCardData,
  sanitizeCharacterLibrary,
  sanitizeCharacterPortraitReference,
} from '../features/character-creator/lib/cards/character-library';
import type { iCharacterLibraryItem } from '../features/character-creator/lib/cards/character-library';
import { readStoredCharacterLibrary } from '../features/character-creator/lib/cards/character-library-storage';
import { STORED_EXAMPLE_CHARACTER_SCHEMA } from '../features/character-creator/lib/cards/example-characters';
import { ARCHIVE_FORMATS } from '../features/character-creator/lib/cards/export-settings';
import { STORED_FIELD_TEMPLATE_SCHEMA } from '../features/character-creator/lib/cards/field-templates';
import { readCharacterAssetBlob } from '../features/character-creator/lib/cards/image-store';
import { downloadBlob } from '../features/character-creator/lib/cards/image-utils';
import {
  sanitizeCharacterGenerationConnectionSettings,
  sanitizeCharacterGenerationPromptSettings,
  sanitizeCharacterGenerationSettings,
} from '../features/character-creator/lib/generation/generation-config';
import { UI_PREFERENCE_SCHEMA } from './collections/ui-preferences.collection';
import { applicationDatabase } from './database';

interface iMigrationBase {
  id: string;
  run: (transaction: Transaction) => Promise<void>;
}

export interface iSafeMigration extends iMigrationBase {
  isDestructive: false;
}

export interface iDestructiveMigration extends iMigrationBase {
  isDestructive: true;
  warning: string;
}

export type ApplicationMigration = iSafeMigration | iDestructiveMigration;

const LEGACY_LIBRARY_KEY = 'tenzo:character-creator:library';
const LEGACY_EXAMPLES_KEY = 'tenzo:character-creator:example-characters';
const LEGACY_CARD_KEY = 'tenzo:character-creator:card';
const LEGACY_PORTRAIT_KEY = 'tenzo:character-creator:portrait';
const LEGACY_GENERATION_SETTINGS_KEY = 'tenzo:character-creator:generation-settings';
const UI_PREFERENCES_STORAGE_KEY = 'tenzo:ui-preferences';
const GENERATION_SETTINGS_STORAGE_KEY = 'tenzo:character-creator:generation-settings';

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

function readTanstackCollection<T>(storageKey: string, schema: z.ZodType<T>) {
  const storedValue = parseStoredJsonValue(window.localStorage.getItem(storageKey));
  if (!storedValue || typeof storedValue !== 'object' || Array.isArray(storedValue)) {
    return [];
  }

  return Object.values(storedValue).flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) || !('data' in entry)) {
      return [];
    }

    const result = schema.safeParse((entry as { data: unknown }).data);
    return result.success ? [result.data] : [];
  });
}

function readLegacySingleCharacter(): iCharacterLibraryItem[] {
  const legacyCardValue = parseStoredJsonValue(window.localStorage.getItem(LEGACY_CARD_KEY));
  if (!legacyCardValue || typeof legacyCardValue !== 'object') {
    return [];
  }

  const legacyGenerationSettings = sanitizeCharacterGenerationSettings(
    parseStoredJsonValue(window.localStorage.getItem(LEGACY_GENERATION_SETTINGS_KEY)),
  );
  const [character] = sanitizeCharacterLibrary([
    {
      id: DEFAULT_CHARACTER_LIBRARY_ITEM_ID,
      card: legacyCardValue,
      portrait: sanitizeCharacterPortraitReference(
        parseStoredJsonValue(window.localStorage.getItem(LEGACY_PORTRAIT_KEY)),
      ),
      promptSettings: sanitizeCharacterGenerationPromptSettings(legacyGenerationSettings),
      source: CHARACTER_LIBRARY_SOURCES.manual,
    },
  ]);

  return character && (hasMeaningfulCharacterCardData(character.card) || character.portrait !== null)
    ? [character]
    : [];
}

async function importLocalStorageData(transaction: Transaction) {
  const characterLibrary = readStoredCharacterLibrary(
    window.localStorage.getItem(CHARACTER_LIBRARY_COLLECTION_STORAGE_KEY),
  );
  const legacyCharacterLibrary = sanitizeCharacterLibrary(
    parseStoredJsonValue(window.localStorage.getItem(LEGACY_LIBRARY_KEY)),
  );
  let characters = readLegacySingleCharacter();
  if (legacyCharacterLibrary.length > 0) {
    characters = legacyCharacterLibrary;
  }
  if (characterLibrary.length > 0) {
    characters = characterLibrary;
  }

  const exampleCharacters = readTanstackCollection(
    EXAMPLE_CHARACTERS_COLLECTION_STORAGE_KEY,
    STORED_EXAMPLE_CHARACTER_SCHEMA,
  );
  const legacyExamples = Array.isArray(parseStoredJsonValue(window.localStorage.getItem(LEGACY_EXAMPLES_KEY)))
    ? (parseStoredJsonValue(window.localStorage.getItem(LEGACY_EXAMPLES_KEY)) as unknown[]).flatMap((value) => {
        const result = STORED_EXAMPLE_CHARACTER_SCHEMA.safeParse(value);
        return result.success ? [result.data] : [];
      })
    : [];
  const fieldTemplates = readTanstackCollection(FIELD_TEMPLATES_COLLECTION_STORAGE_KEY, STORED_FIELD_TEMPLATE_SCHEMA);
  const sessionValues = [
    CHARACTER_ASSISTANT_SESSIONS_COLLECTION_STORAGE_KEY,
    ...LEGACY_CHARACTER_AGENT_SESSION_STORAGE_KEYS,
  ].flatMap((storageKey) => readStoredCollectionItems(window.localStorage.getItem(storageKey)));
  const assistantSessions = selectLatestSessions(sessionValues);
  const assistantDrafts = readTanstackCollection(
    CHARACTER_ASSISTANT_COMPOSER_DRAFTS_STORAGE_KEY,
    CHARACTER_ASSISTANT_COMPOSER_DRAFT_SCHEMA,
  );

  const uiPreferences = readTanstackCollection(UI_PREFERENCES_STORAGE_KEY, UI_PREFERENCE_SCHEMA);

  await Promise.all([
    transaction.table('characterLibrary').bulkPut(characters),
    transaction.table('exampleCharacters').bulkPut(exampleCharacters.length > 0 ? exampleCharacters : legacyExamples),
    transaction.table('fieldTemplates').bulkPut(fieldTemplates),
    transaction.table('characterAssistantSessions').bulkPut(assistantSessions),
    transaction.table('characterAssistantComposerDrafts').bulkPut(assistantDrafts),
    transaction.table('uiPreferences').bulkPut(uiPreferences),
  ]);
}

export const APPLICATION_MIGRATIONS = [
  {
    id: '001-import-tanstack-local-storage',
    isDestructive: false,
    run: importLocalStorageData,
  },
] satisfies readonly ApplicationMigration[];

export async function getPendingMigrations() {
  await applicationDatabase.open();
  const completedMigrationIds = new Set((await applicationDatabase.migrationState.toArray()).map(({ id }) => id));
  return APPLICATION_MIGRATIONS.filter(({ id }) => !completedMigrationIds.has(id));
}

export async function runMigrations(migrations: readonly ApplicationMigration[]) {
  for (const migration of migrations) {
    await applicationDatabase.transaction('rw', applicationDatabase.tables, async (transaction) => {
      await migration.run(transaction);
      await transaction.table('migrationState').put({ id: migration.id, completedAt: new Date().toISOString() });
    });
  }
}

export async function downloadMigrationBackup() {
  const indexedDbData = Object.fromEntries(
    await Promise.all(applicationDatabase.tables.map(async (table) => [table.name, await table.toArray()] as const)),
  );
  const localStorageData = Object.fromEntries(
    Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index)).flatMap((key) =>
      key === null ? [] : [[key, window.localStorage.getItem(key)]],
    ),
  );
  const characters = await applicationDatabase.characterLibrary.toArray();
  const assets: iBackupPortraitAsset[] = [];

  for (const character of characters) {
    if (!character.portrait) {
      continue;
    }

    const blob = await readCharacterAssetBlob(character.portrait.assetId);
    if (blob) {
      assets.push({
        assetId: character.portrait.assetId,
        mimeType: character.portrait.mimeType,
        bytes: new Uint8Array(await blob.arrayBuffer()),
      });
    }
  }

  const connectionSettings = sanitizeCharacterGenerationConnectionSettings(
    parseStoredJsonValue(window.localStorage.getItem(GENERATION_SETTINGS_STORAGE_KEY)),
  );
  const files = buildFullBackupFiles({
    characters,
    exampleCharacters: await applicationDatabase.exampleCharacters.toArray(),
    connectionSettings,
    assets,
  });
  files.push({
    path: 'migration-snapshot.json',
    data: new TextEncoder().encode(
      JSON.stringify({ exportedAt: new Date().toISOString(), indexedDbData, localStorageData }, null, 2),
    ),
  });

  const archiveBlob = createArchiveBlob(files, ARCHIVE_FORMATS.zip);
  const dateStamp = new Date().toISOString().slice(0, 10);
  downloadBlob(archiveBlob, `tenzo-migration-backup-${dateStamp}.zip`);
}
