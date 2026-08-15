import { describe, expect, it } from 'vitest';

import { REQUEST_MODES } from '../generation/generation-config';
import { probeProviderMetadataWithProxyFetcher } from './provider-health';

describe('provider health model metadata', () => {
  it('uses the selected model context window from OpenAI-compatible model metadata', async () => {
    const result = await probeProviderMetadataWithProxyFetcher(
      {
        endpoint: 'https://openrouter.ai/api/v1',
        apiKey: 'test-key',
        requestMode: REQUEST_MODES.proxy,
        model: 'vision-model',
      },
      async (url) =>
        url.endsWith('/models')
          ? {
              isOk: true,
              status: 200,
              data: {
                data: [
                  { id: 'text-model', context_length: 32_768 },
                  { id: 'vision-model', context_length: 131_072 },
                ],
              },
            }
          : { isOk: false, status: 404, data: null },
    );

    expect(result.contextSize).toBe(131_072);
    expect(result.modelContextSizes).toEqual({
      'text-model': 32_768,
      'vision-model': 131_072,
    });
  });
});
