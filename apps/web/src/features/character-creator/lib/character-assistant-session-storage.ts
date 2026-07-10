import type { StorageApi } from '@tanstack/react-db';

import { generateUuid } from '@~/utils/uuid';

import { sanitizeCharacterAssistantSession } from './character-assistant-session';
import type { iCharacterAssistantSession } from './character-assistant-session';

interface iStoredCollectionItem {
  versionKey: string;
  data: unknown;
}

interface iMigrateCharacterAssistantSessionStorageOptions {
  storage: StorageApi;
  legacyStorageKeys: string[];
  storageKey: string;
}

function readStoredCollectionItems(value: string | null) {
  if (!value) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(value) as unknown;
    if (!parsedValue || typeof parsedValue !== 'object' || Array.isArray(parsedValue)) {
      return [];
    }

    return Object.values(parsedValue as Record<string, unknown>).flatMap((storedItem) => {
      if (!storedItem || typeof storedItem !== 'object' || Array.isArray(storedItem) || !('data' in storedItem)) {
        return [];
      }

      return [(storedItem as iStoredCollectionItem).data];
    });
  } catch {
    return [];
  }
}

function selectLatestSessions(values: unknown[]) {
  const sessionsByCharacterId = new Map<string, iCharacterAssistantSession>();

  values.forEach((value) => {
    const session = sanitizeCharacterAssistantSession(value);
    if (!session) {
      return;
    }

    const existingSession = sessionsByCharacterId.get(session.characterId);
    if (!existingSession || existingSession.updatedAt < session.updatedAt) {
      sessionsByCharacterId.set(session.characterId, session);
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
