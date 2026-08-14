import { applicationDatabase } from '@~/db/database';
import { PersistentCollection } from '@~/db/persistent-collection';

import { STORED_FIELD_TEMPLATE_SCHEMA } from '../lib/cards/field-templates';

export const FIELD_TEMPLATES_COLLECTION_STORAGE_KEY = 'tenzo:character-creator:field-templates:v1';

export const fieldTemplatesCollection = new PersistentCollection({
  table: applicationDatabase.fieldTemplates,
  getKey: (item) => item.id,
  schema: STORED_FIELD_TEMPLATE_SCHEMA,
});
