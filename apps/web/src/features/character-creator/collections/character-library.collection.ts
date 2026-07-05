import { createCollection, localStorageCollectionOptions } from '@tanstack/react-db';

import { localStorageApi } from '@~/db/storage';

import { CHARACTER_LIBRARY_ITEM_SCHEMA } from '../lib/character-library';

export const CHARACTER_LIBRARY_COLLECTION_STORAGE_KEY = 'tenzo:character-creator:library:v2';

export const characterLibraryCollection = createCollection(
  localStorageCollectionOptions({
    storageKey: CHARACTER_LIBRARY_COLLECTION_STORAGE_KEY,
    storage: localStorageApi,
    getKey: (item) => item.id,
    schema: CHARACTER_LIBRARY_ITEM_SCHEMA,
  }),
);
