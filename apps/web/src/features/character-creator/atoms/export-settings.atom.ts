import { atomWithStorage, createJSONStorage } from 'jotai/utils';

import { localStorageApi } from '@~/db/storage';

import { DEFAULT_EXPORT_SETTINGS } from '../lib/export-settings';
import type { iExportSettings } from '../lib/export-settings';

const exportSettingsStorage = createJSONStorage<iExportSettings>(() => localStorageApi);

export const exportSettingsAtom = atomWithStorage<iExportSettings>(
  'tenzo:character-creator:export-settings',
  DEFAULT_EXPORT_SETTINGS,
  exportSettingsStorage,
);
