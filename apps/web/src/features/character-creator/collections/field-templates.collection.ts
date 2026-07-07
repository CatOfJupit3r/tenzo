import { createCollection, localStorageCollectionOptions } from '@tanstack/react-db';

import { localStorageApi } from '@~/db/storage';

import { STORED_FIELD_TEMPLATE_SCHEMA } from '../lib/field-templates';

export const FIELD_TEMPLATES_COLLECTION_STORAGE_KEY = 'tenzo:character-creator:field-templates:v1';

export const fieldTemplatesCollection = createCollection(
  localStorageCollectionOptions({
    storageKey: FIELD_TEMPLATES_COLLECTION_STORAGE_KEY,
    storage: localStorageApi,
    getKey: (item) => item.id,
    schema: STORED_FIELD_TEMPLATE_SCHEMA,
  }),
);
