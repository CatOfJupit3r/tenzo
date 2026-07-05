import { atomWithStorage, createJSONStorage } from 'jotai/utils';

import { localStorageApi } from '@~/db/storage';

import { DEFAULT_CHARACTER_GENERATION_CONNECTION_SETTINGS } from '../lib/generation-config';
import type { iCharacterGenerationConnectionSettings } from '../lib/generation-config';

const generationSettingsStorage = createJSONStorage<iCharacterGenerationConnectionSettings>(() => localStorageApi);

export const characterGenerationSettingsAtom = atomWithStorage<iCharacterGenerationConnectionSettings>(
  'tenzo:character-creator:generation-settings',
  DEFAULT_CHARACTER_GENERATION_CONNECTION_SETTINGS,
  generationSettingsStorage,
);
