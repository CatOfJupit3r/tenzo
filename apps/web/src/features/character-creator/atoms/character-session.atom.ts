import { atomWithStorage, createJSONStorage } from 'jotai/utils';

import { localStorageApi } from '@~/db/storage';

import { DEFAULT_CHARACTER_LIBRARY_ITEM_ID } from '../lib/character-library';
import type { iCharacterLibraryItem } from '../lib/character-library';
import type { iStoredExampleCharacter } from '../lib/example-characters';

const characterLibraryStorage = createJSONStorage<iCharacterLibraryItem[]>(() => localStorageApi);
const activeCharacterIdStorage = createJSONStorage<string>(() => localStorageApi);
const exampleCharactersStorage = createJSONStorage<iStoredExampleCharacter[]>(() => localStorageApi);

export const characterLibraryAtom = atomWithStorage<iCharacterLibraryItem[]>(
  'tenzo:character-creator:library',
  [],
  characterLibraryStorage,
);

export const activeCharacterIdAtom = atomWithStorage<string>(
  'tenzo:character-creator:active-character-id',
  DEFAULT_CHARACTER_LIBRARY_ITEM_ID,
  activeCharacterIdStorage,
);

export const exampleCharactersAtom = atomWithStorage<iStoredExampleCharacter[]>(
  'tenzo:character-creator:example-characters',
  [],
  exampleCharactersStorage,
);
