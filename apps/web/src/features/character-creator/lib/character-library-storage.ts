import type { Parser } from '@tanstack/react-db';

import { localStorageApi } from '@~/db/storage';

import { sanitizeCharacterLibraryItem } from './character-library';

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

export const characterLibraryStorageParser = {
  parse(value: string) {
    const parsed = JSON.parse(value) as unknown;

    if (!isRecord(parsed)) {
      return parsed;
    }

    return Object.fromEntries(
      Object.entries(parsed).flatMap(([key, storedValue]) => {
        const storedEntry = sanitizeStoredEntry(storedValue);
        return storedEntry ? [[key, storedEntry]] : [];
      }),
    );
  },
  stringify(value: unknown) {
    return JSON.stringify(value);
  },
} satisfies Parser;

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
