import { describe, expect, it } from 'vitest';

import { REQUEST_MODES } from '../generation/generation-config';
import { MODEL_CAPABILITIES } from './model-capabilities';
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
                  { id: 'text-model', context_length: 32_768, supported_parameters: ['response_format'] },
                  {
                    id: 'vision-model',
                    context_length: 131_072,
                    supported_parameters: ['structured_outputs', 'tools'],
                  },
                ],
              },
            }
          : { isOk: false, status: 404, data: null },
    );

    expect(result.contextSize).toBe(131_072);
    expect(result.models).toEqual([
      { label: 'text-model', value: 'text-model' },
      { label: 'vision-model', value: 'vision-model' },
    ]);
    expect(result.modelContextSizes).toEqual({
      'text-model': 32_768,
      'vision-model': 131_072,
    });
    expect(result.modelCapabilities).toEqual({
      'text-model': {
        [MODEL_CAPABILITIES['structured-output']]: true,
        [MODEL_CAPABILITIES['tool-calling']]: false,
        hasJointStructuredOutputAndToolCalling: false,
      },
      'vision-model': {
        [MODEL_CAPABILITIES['structured-output']]: true,
        [MODEL_CAPABILITIES['tool-calling']]: true,
        hasJointStructuredOutputAndToolCalling: true,
      },
    });
  });

  it('uses the preview name as the label without adding it as a duplicate model', async () => {
    const result = await probeProviderMetadataWithProxyFetcher(
      {
        endpoint: 'https://openrouter.ai/api/v1',
        apiKey: 'test-key',
        requestMode: REQUEST_MODES.proxy,
      },
      async (url) =>
        url.endsWith('/models')
          ? {
              isOk: true,
              status: 200,
              data: {
                data: [{ id: 'mistralai/mistral-nemo', name: 'Mistral Nemo' }],
              },
            }
          : { isOk: false, status: 404, data: null },
    );

    expect(result.models).toEqual([
      {
        label: 'Mistral Nemo (mistralai/mistral-nemo)',
        value: 'mistralai/mistral-nemo',
      },
    ]);
  });

  it('does not combine capabilities published by different OpenRouter endpoints', async () => {
    const model = 'mistralai/mistral-nemo';
    const result = await probeProviderMetadataWithProxyFetcher(
      {
        endpoint: 'https://openrouter.ai/api/v1',
        apiKey: '',
        requestMode: REQUEST_MODES.proxy,
        model,
      },
      async (url) => {
        if (url.endsWith(`models/${model}/endpoints`)) {
          return {
            isOk: true,
            status: 200,
            data: {
              data: {
                endpoints: [
                  {
                    provider_name: 'Structured Provider',
                    tag: 'structured/fp8',
                    supported_parameters: ['response_format', 'structured_outputs'],
                  },
                  {
                    provider_name: 'Tool Provider',
                    tag: 'tools/fp16',
                    supported_parameters: ['tools', 'tool_choice'],
                  },
                ],
              },
            },
          };
        }

        if (url.endsWith('/models')) {
          return {
            isOk: true,
            status: 200,
            data: { data: [{ id: model, supported_parameters: ['structured_outputs', 'tools'] }] },
          };
        }

        return { isOk: false, status: 404, data: null };
      },
    );

    expect(result.modelCapabilities[model]).toEqual({
      [MODEL_CAPABILITIES['structured-output']]: true,
      [MODEL_CAPABILITIES['tool-calling']]: true,
      hasJointStructuredOutputAndToolCalling: false,
    });
    expect(result.modelProviders).toHaveLength(2);
  });

  it('intersects unmoderated model metadata with the live ZDR endpoint catalog', async () => {
    const model = 'test/unmoderated';
    const result = await probeProviderMetadataWithProxyFetcher(
      {
        endpoint: 'https://openrouter.ai/api/v1',
        apiKey: 'test-key',
        requestMode: REQUEST_MODES.proxy,
        model,
      },
      async (url) => {
        if (url.endsWith('/endpoints/zdr')) {
          return {
            isOk: true,
            status: 200,
            data: {
              data: [
                {
                  model_id: model,
                  tag: 'eligible/fp16',
                  supported_parameters: ['structured_outputs', 'tools'],
                  status: 0,
                  pricing: { prompt: '0.000001', completion: '0.000002' },
                },
                {
                  model_id: 'another/model',
                  tag: 'other/fp16',
                  supported_parameters: ['structured_outputs'],
                  status: 0,
                  pricing: { prompt: '0', completion: '0' },
                },
              ],
            },
          };
        }

        if (url.endsWith('/models')) {
          return {
            isOk: true,
            status: 200,
            data: {
              data: [
                {
                  id: model,
                  top_provider: { is_moderated: false },
                  supported_parameters: ['structured_outputs', 'tools'],
                },
              ],
            },
          };
        }

        return { isOk: false, status: 404, data: null };
      },
    );

    expect(result.policyCatalog).toEqual({
      fetchedAt: expect.any(String),
      models: [
        {
          modelId: model,
          isModerated: false,
          endpoints: [
            {
              providerSlug: 'eligible',
              isZeroDataRetention: true,
              doesCollectData: false,
              isAvailable: true,
              supportedCapabilities: [MODEL_CAPABILITIES['structured-output'], MODEL_CAPABILITIES['tool-calling']],
              promptPricePerMillionUsd: 1,
              completionPricePerMillionUsd: 2,
            },
          ],
        },
      ],
    });
  });
});
