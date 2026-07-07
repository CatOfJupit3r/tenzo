import { createCollection, localStorageCollectionOptions } from '@tanstack/react-db';

import { localStorageApi } from '@~/db/storage';

import { CHARACTER_AGENT_SESSION_SCHEMA } from '../lib/character-agent-session';

export const CHARACTER_AGENT_SESSIONS_COLLECTION_STORAGE_KEY = 'tenzo:character-creator:agent-sessions:v1';

export const characterAgentSessionsCollection = createCollection(
  localStorageCollectionOptions({
    storageKey: CHARACTER_AGENT_SESSIONS_COLLECTION_STORAGE_KEY,
    storage: localStorageApi,
    getKey: (item) => item.id,
    schema: CHARACTER_AGENT_SESSION_SCHEMA,
  }),
);
