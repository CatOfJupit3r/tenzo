import { z } from 'zod';

import { applicationDatabase } from '../database';
import { PersistentCollection } from '../persistent-collection';

export const UI_PREFERENCE_SCHEMA = z.object({
  id: z.string(),
  value: z.string(),
});

export type UiPreference = z.infer<typeof UI_PREFERENCE_SCHEMA>;

export const uiPreferencesCollection = new PersistentCollection({
  table: applicationDatabase.uiPreferences,
  getKey: (item) => item.id,
  schema: UI_PREFERENCE_SCHEMA,
});
