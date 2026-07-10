import { createCollection, localStorageCollectionOptions } from '@tanstack/react-db';

import { localStorageApi } from '@~/db/storage';

import {
  CHARACTER_ASSISTANT_SESSION_SCHEMA,
  createCharacterAssistantSession,
} from '../lib/character-assistant-session';
import type { iCharacterAssistantSession } from '../lib/character-assistant-session';
import { migrateCharacterAssistantSessionStorage } from '../lib/character-assistant-session-storage';

export const CHARACTER_ASSISTANT_SESSIONS_COLLECTION_STORAGE_KEY = 'tenzo:character-creator:assistant-sessions:v1';
const LEGACY_CHARACTER_AGENT_SESSION_STORAGE_KEYS = [
  'tenzo:character-creator:agent-sessions:v2',
  'tenzo:character-creator:agent-sessions:v1',
];

migrateCharacterAssistantSessionStorage({
  storage: localStorageApi,
  legacyStorageKeys: LEGACY_CHARACTER_AGENT_SESSION_STORAGE_KEYS,
  storageKey: CHARACTER_ASSISTANT_SESSIONS_COLLECTION_STORAGE_KEY,
});

export const characterAssistantSessionsCollection = createCollection(
  localStorageCollectionOptions({
    storageKey: CHARACTER_ASSISTANT_SESSIONS_COLLECTION_STORAGE_KEY,
    storage: localStorageApi,
    getKey: (item) => item.id,
    schema: CHARACTER_ASSISTANT_SESSION_SCHEMA,
  }),
);

export async function ensureCharacterAssistantSession(characterId: string) {
  await characterAssistantSessionsCollection.preload();
  const existingSession = characterAssistantSessionsCollection.get(characterId);
  if (existingSession) {
    return CHARACTER_ASSISTANT_SESSION_SCHEMA.parse(existingSession);
  }

  const session = createCharacterAssistantSession(characterId);
  const transaction = characterAssistantSessionsCollection.insert(session);
  await transaction.isPersisted.promise;
  return CHARACTER_ASSISTANT_SESSION_SCHEMA.parse(characterAssistantSessionsCollection.get(session.id) ?? session);
}

export async function updateCharacterAssistantSession(
  sessionId: string,
  recipe: (draft: iCharacterAssistantSession) => unknown,
) {
  if (!characterAssistantSessionsCollection.has(sessionId)) {
    throw new Error(`Character assistant session "${sessionId}" is unavailable.`);
  }

  const transaction = characterAssistantSessionsCollection.update(sessionId, (draft) => {
    recipe(draft as iCharacterAssistantSession);
    draft.updatedAt = new Date().toISOString();
  });
  await transaction.isPersisted.promise;

  const persistedSession = characterAssistantSessionsCollection.get(sessionId);
  if (!persistedSession) {
    throw new Error(`Character assistant session "${sessionId}" was not persisted.`);
  }

  return CHARACTER_ASSISTANT_SESSION_SCHEMA.parse(persistedSession);
}
