import { z } from 'zod';

import type { iStorageApi } from '@~/db/storage';
import { generateUuid } from '@~/utils/uuid';

import { sanitizeCharacterAssistantSession } from './character-assistant-session';
import type { iCharacterAssistantSession } from './character-assistant-session';

const STORED_COLLECTION_ITEM_SCHEMA = z.object({
  versionKey: z.string(),
  data: z.unknown(),
});

const STORED_COLLECTION_SCHEMA = z.record(z.string(), STORED_COLLECTION_ITEM_SCHEMA);

interface iMigrateCharacterAssistantSessionStorageOptions {
  storage: iStorageApi;
  legacyStorageKeys: string[];
  storageKey: string;
}

export function readStoredCollectionItems(value: string | null): iCharacterAssistantSession[] {
  if (!value) {
    return [];
  }

  try {
    const parsedValue = STORED_COLLECTION_SCHEMA.safeParse(JSON.parse(value));
    if (!parsedValue.success) {
      return [];
    }

    return Object.values(parsedValue.data).flatMap((storedItem) => {
      const session = sanitizeCharacterAssistantSession(storedItem.data);
      return session ? [session] : [];
    });
  } catch {
    return [];
  }
}

export function selectLatestSessions(values: readonly iCharacterAssistantSession[]) {
  const sessionsByCharacterId = new Map<string, iCharacterAssistantSession>();

  values.forEach((value) => {
    const existingSession = sessionsByCharacterId.get(value.characterId);
    if (!existingSession || existingSession.updatedAt < value.updatedAt) {
      sessionsByCharacterId.set(value.characterId, value);
    }
  });

  return [...sessionsByCharacterId.values()];
}

export function migrateCharacterAssistantSessionStorage({
  storage,
  legacyStorageKeys,
  storageKey,
}: iMigrateCharacterAssistantSessionStorageOptions) {
  try {
    if (storage.getItem(storageKey) !== null) {
      return;
    }

    const legacyValues = legacyStorageKeys.flatMap((legacyStorageKey) =>
      readStoredCollectionItems(storage.getItem(legacyStorageKey)),
    );

    if (legacyValues.length === 0) {
      return;
    }

    const migratedValue = Object.fromEntries(
      selectLatestSessions(legacyValues).map((session) => [
        `s:${session.id}`,
        {
          versionKey: generateUuid(),
          data: session,
        },
      ]),
    );

    storage.setItem(storageKey, JSON.stringify(migratedValue));
    legacyStorageKeys.forEach((legacyStorageKey) => storage.removeItem(legacyStorageKey));
  } catch {
    // Leave source values untouched so recovery can retry on a later load.
  }
}
