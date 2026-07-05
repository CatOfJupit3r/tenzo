import { atomWithStorage, createJSONStorage } from 'jotai/utils';

import { localStorageApi } from '@~/db/storage';

import { DEFAULT_CHARACTER_LIBRARY_ITEM_ID } from '../lib/character-library';

const activeCharacterIdStorage = createJSONStorage<string>(() => localStorageApi);

export const activeCharacterIdAtom = atomWithStorage<string>(
  'tenzo:character-creator:active-character-id',
  DEFAULT_CHARACTER_LIBRARY_ITEM_ID,
  activeCharacterIdStorage,
);
