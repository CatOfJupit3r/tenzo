import { localStorageApi } from '@~/db/storage';

import { sanitizeCharacterLibraryItem } from './character-library';
import type { iCharacterLibraryItem } from './character-library';

interface iStoredCharacterLibraryEntry {
  versionKey: string;
  data: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeStoredEntry(value: unknown): iStoredCharacterLibraryEntry | null {
  if (!isRecord(value) || typeof value.versionKey !== 'string') {
    return null;
  }

  const character = sanitizeCharacterLibraryItem(value.data);
  return character ? { versionKey: value.versionKey, data: character } : null;
}

export function readStoredCharacterLibrary(value: string | null): iCharacterLibraryItem[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!isRecord(parsed)) {
      return [];
    }

    return Object.values(parsed).flatMap((storedValue) => {
      const storedEntry = sanitizeStoredEntry(storedValue);
      return storedEntry ? [storedEntry.data as iCharacterLibraryItem] : [];
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
    const parsed = JSON.parse(storedValue) as unknown;
    return isRecord(parsed) && Object.keys(parsed).length > 0;
  } catch {
    return true;
  }
}
