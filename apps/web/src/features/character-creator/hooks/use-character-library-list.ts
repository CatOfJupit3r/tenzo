import { useLiveQuery } from '@tanstack/react-db';
import { useRef, useState } from 'react';

import { useIsomorphicLayoutEffect } from '@~/hooks/use-isomorphic-layout-effect';

import { characterLibraryCollection } from '../collections/character-library.collection';
import { ensureCharacterCreatorSessionInitialized } from '../lib/character-library-migration';

/**
 * Reactive view of the character library ordered by creation time. Owns the
 * one-time session initialization so any consumer (library panel or editor
 * session) can read the library independently without funneling through a shared
 * page context.
 */
export function useCharacterLibraryList() {
  const hasInitializedRef = useRef(false);
  const [isSessionInitialized, setIsSessionInitialized] = useState(false);

  useIsomorphicLayoutEffect(() => {
    if (hasInitializedRef.current) {
      return;
    }

    hasInitializedRef.current = true;
    ensureCharacterCreatorSessionInitialized();
    setIsSessionInitialized(true);
  }, []);

  const { data: characterLibrary, isReady: isLibraryQueryReady } = useLiveQuery((query) =>
    query.from({ character: characterLibraryCollection }).orderBy(({ character }) => character.createdAt, 'asc'),
  );

  return {
    characterLibrary,
    isCharacterLibraryReady: isSessionInitialized && isLibraryQueryReady,
  };
}
