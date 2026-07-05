import { atomWithStorage, createJSONStorage } from 'jotai/utils';

import { localStorageApi } from '@~/db/storage';

import { createEmptyCharacterCard } from '../constants/card-defaults';
import type { CharacterCard } from '../lib/card-schema';

const characterCardStorage = createJSONStorage<CharacterCard>(() => localStorageApi);

export const characterCardAtom = atomWithStorage<CharacterCard>(
  'tenzo:character-creator:card',
  createEmptyCharacterCard(),
  characterCardStorage,
);
