import { atomWithStorage, createJSONStorage } from 'jotai/utils';

import { localStorageApi } from '@~/db/storage';

import type { iGenerationPreset } from '../lib/generation/generation-presets';

const generationPresetsStorage = createJSONStorage<iGenerationPreset[]>(() => localStorageApi);

export const generationPresetsAtom = atomWithStorage<iGenerationPreset[]>(
  'tenzo:character-creator:generation-presets',
  [],
  generationPresetsStorage,
);
