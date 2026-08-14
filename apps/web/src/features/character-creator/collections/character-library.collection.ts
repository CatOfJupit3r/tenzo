import { applicationDatabase } from '@~/db/database';
import { PersistentCollection } from '@~/db/persistent-collection';

import { CHARACTER_LIBRARY_ITEM_SCHEMA } from '../lib/cards/character-library';

export const CHARACTER_LIBRARY_COLLECTION_STORAGE_KEY = 'tenzo:character-creator:library:v2';

export const characterLibraryCollection = new PersistentCollection({
  table: applicationDatabase.characterLibrary,
  getKey: (item) => item.id,
  schema: CHARACTER_LIBRARY_ITEM_SCHEMA,
});
