import { applicationDatabase } from '@~/db/database';
import { PersistentCollection } from '@~/db/persistent-collection';

import {
  CHARACTER_ASSISTANT_SESSION_SCHEMA,
  createCharacterAssistantSession,
} from '../lib/assistant/character-assistant-session';
import type { iCharacterAssistantSession } from '../lib/assistant/character-assistant-session';

export const CHARACTER_ASSISTANT_SESSIONS_COLLECTION_STORAGE_KEY = 'tenzo:character-creator:assistant-sessions:v4';
export const LEGACY_CHARACTER_AGENT_SESSION_STORAGE_KEYS = [
  'tenzo:character-creator:assistant-sessions:v3',
  'tenzo:character-creator:assistant-sessions:v2',
  'tenzo:character-creator:assistant-sessions:v1',
  'tenzo:character-creator:agent-sessions:v2',
  'tenzo:character-creator:agent-sessions:v1',
];

export const characterAssistantSessionsCollection = new PersistentCollection({
  table: applicationDatabase.characterAssistantSessions,
  getKey: (item) => item.id,
  schema: CHARACTER_ASSISTANT_SESSION_SCHEMA,
});

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

export async function removeCharacterAssistantSession(characterId: string) {
  await characterAssistantSessionsCollection.preload();
  const transaction = characterAssistantSessionsCollection.delete(characterId);
  await transaction.isPersisted.promise;
}

export async function updateCharacterAssistantSession(
  sessionId: string,
  recipe: (draft: iCharacterAssistantSession) => unknown,
) {
  await characterAssistantSessionsCollection.preload();
  if (!characterAssistantSessionsCollection.has(sessionId)) {
    throw new Error(`Character assistant session "${sessionId}" is unavailable.`);
  }

  const transaction = characterAssistantSessionsCollection.update(sessionId, (draft) => {
    recipe(draft);
    draft.updatedAt = new Date().toISOString();
  });
  await transaction.isPersisted.promise;

  const persistedSession = characterAssistantSessionsCollection.get(sessionId);
  if (!persistedSession) {
    throw new Error(`Character assistant session "${sessionId}" was not persisted.`);
  }
  return CHARACTER_ASSISTANT_SESSION_SCHEMA.parse(persistedSession);
}
