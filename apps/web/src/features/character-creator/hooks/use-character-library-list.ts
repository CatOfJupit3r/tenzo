import { useMemo } from 'react';

import { usePersistentCollection } from '@~/db/persistent-collection';

import { characterLibraryCollection } from '../collections/character-library.collection';

/**
 * Reactive view of the character library ordered by creation time. Owns the
 * one-time session initialization so any consumer (library panel or editor
 * session) can read the library independently without funneling through a shared
 * page context.
 */
export function useCharacterLibraryList() {
  const storedCharacters = usePersistentCollection(characterLibraryCollection);
  const characterLibrary = useMemo(
    () => [...storedCharacters].sort((first, second) => first.createdAt.localeCompare(second.createdAt)),
    [storedCharacters],
  );

  return {
    characterLibrary,
    isCharacterLibraryReady: true,
  };
}
