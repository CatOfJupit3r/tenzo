import { z } from 'zod';

import { localStorageApi } from '@~/db/storage';

import { sanitizeCharacterLibraryItem } from './character-library';
import type { iCharacterLibraryItem } from './character-library';

const STORED_CHARACTER_LIBRARY_ENTRY_SCHEMA = z.object({
  versionKey: z.string(),
  data: z.unknown(),
});

const STORED_CHARACTER_LIBRARY_COLLECTION_SCHEMA = z.record(z.string(), STORED_CHARACTER_LIBRARY_ENTRY_SCHEMA);

export function readStoredCharacterLibrary(value: string | null): iCharacterLibraryItem[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = STORED_CHARACTER_LIBRARY_COLLECTION_SCHEMA.safeParse(JSON.parse(value));
    if (!parsed.success) {
      return [];
    }

    return Object.values(parsed.data).flatMap((storedEntry) => {
      const character = sanitizeCharacterLibraryItem(storedEntry.data);
      return character ? [character] : [];
    });
  } catch {
    return [];
  }
}

export function hasStoredCharacterLibraryEntries(storageKey: string) {
  const storedValue = localStorageApi.getItem(storageKey);

  if (!storedValue) {
    return false;
  }

  try {
    const parsed = STORED_CHARACTER_LIBRARY_COLLECTION_SCHEMA.safeParse(JSON.parse(storedValue));
    return parsed.success && Object.keys(parsed.data).length > 0;
  } catch {
    return true;
  }
}
