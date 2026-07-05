import { atomWithStorage, createJSONStorage } from 'jotai/utils';

import { localStorageApi } from '@~/db/storage';

import { createEmptyCharacterCard } from '../constants/card-defaults';
import type { CharacterCard } from '../lib/card-schema';

const characterCardStorage = createJSONStorage<CharacterCard>(() => localStorageApi);
const characterPortraitStorage = createJSONStorage<iCharacterPortraitStorageValue | null>(() => localStorageApi);

export interface iCharacterPortraitStorageValue {
  assetId: string;
  fileName: string;
  mimeType: string;
}

export const characterCardAtom = atomWithStorage<CharacterCard>(
  'tenzo:character-creator:card',
  createEmptyCharacterCard(),
  characterCardStorage,
);

export const characterPortraitAtom = atomWithStorage<iCharacterPortraitStorageValue | null>(
  'tenzo:character-creator:portrait',
  null,
  characterPortraitStorage,
);
