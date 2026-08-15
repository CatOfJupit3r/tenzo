import { describe, expect, it } from 'vitest';

import { DEFAULT_CHARACTER_GENERATION_CONNECTION_SETTINGS } from './generation-config';
import { createGenerationPresetSettings, sanitizeGenerationPresets } from './generation-presets';

describe('generation presets', () => {
  it('captures generation controls without connection or credential fields', () => {
    const settings = createGenerationPresetSettings({
      ...DEFAULT_CHARACTER_GENERATION_CONNECTION_SETTINGS,
      provider: 'openrouter',
      endpoint: 'https://example.test/v1',
      requestMode: 'browser',
      apiKeyCiphertext: 'secret',
      model: 'text-model',
      visionModel: 'vision-model',
    });

    expect(settings).toMatchObject({ model: 'text-model', visionModel: 'vision-model' });
    expect(settings).not.toHaveProperty('provider');
    expect(settings).not.toHaveProperty('endpoint');
    expect(settings).not.toHaveProperty('requestMode');
    expect(settings).not.toHaveProperty('apiKeyCiphertext');
  });

  it('drops invalid stored presets without affecting valid presets', () => {
    const settings = createGenerationPresetSettings(DEFAULT_CHARACTER_GENERATION_CONNECTION_SETTINGS);
    const presets = sanitizeGenerationPresets([
      { id: 'valid', name: 'Balanced', settings },
      { id: '', name: 'Invalid', settings },
    ]);

    expect(presets).toEqual([{ id: 'valid', name: 'Balanced', settings }]);
  });
});
