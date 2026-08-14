import { applicationDatabase } from '@~/db/database';
import { PersistentCollection } from '@~/db/persistent-collection';

import { STORED_EXAMPLE_CHARACTER_SCHEMA } from '../lib/example-characters';

export const EXAMPLE_CHARACTERS_COLLECTION_STORAGE_KEY = 'tenzo:character-creator:example-characters:v2';

export const exampleCharactersCollection = new PersistentCollection({
  table: applicationDatabase.exampleCharacters,
  getKey: (item) => item.id,
  schema: STORED_EXAMPLE_CHARACTER_SCHEMA,
});
