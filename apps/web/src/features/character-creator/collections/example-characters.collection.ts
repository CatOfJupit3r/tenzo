import { createCollection, localStorageCollectionOptions } from '@tanstack/react-db';

import { localStorageApi } from '@~/db/storage';

import { STORED_EXAMPLE_CHARACTER_SCHEMA } from '../lib/example-characters';

export const EXAMPLE_CHARACTERS_COLLECTION_STORAGE_KEY = 'tenzo:character-creator:example-characters:v2';

export const exampleCharactersCollection = createCollection(
  localStorageCollectionOptions({
    storageKey: EXAMPLE_CHARACTERS_COLLECTION_STORAGE_KEY,
    storage: localStorageApi,
    getKey: (item) => item.id,
    schema: STORED_EXAMPLE_CHARACTER_SCHEMA,
  }),
);
