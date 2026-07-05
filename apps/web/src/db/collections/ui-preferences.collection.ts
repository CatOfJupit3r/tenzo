import { createCollection, localStorageCollectionOptions } from '@tanstack/react-db';
import { z } from 'zod';

import { localStorageApi } from '../storage';

/**
 * Example TanStack DB collection backed by `localStorage`.
 *
 * This is a template for client-persisted, server-less data. Rows are written
 * to `localStorage` automatically on every mutation and hydrated on load; use
 * `useLiveQuery` to read reactively and `collection.insert/update/delete` to
 * mutate. No server round-trip and no mutation handlers are needed for
 * local-only data.
 */
export const UI_PREFERENCE_SCHEMA = z.object({
  id: z.string(),
  value: z.string(),
});

export type UiPreference = z.infer<typeof UI_PREFERENCE_SCHEMA>;

export const uiPreferencesCollection = createCollection(
  localStorageCollectionOptions({
    storageKey: 'tenzo:ui-preferences',
    storage: localStorageApi,
    getKey: (item) => item.id,
    schema: UI_PREFERENCE_SCHEMA,
  }),
);
