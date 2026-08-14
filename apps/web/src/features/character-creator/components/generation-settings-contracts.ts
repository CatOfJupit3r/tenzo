import type { iCharacterGenerationConnectionSettings } from '../lib/generation/generation-config';

export type iGenerationSettingsPatchHandler = (
  patch: Partial<Omit<iCharacterGenerationConnectionSettings, 'apiKeyCiphertext'>>,
) => void;
