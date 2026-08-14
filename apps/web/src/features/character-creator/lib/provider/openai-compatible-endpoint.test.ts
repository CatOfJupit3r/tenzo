import { describe, expect, it } from 'vitest';

import { normalizeChatCompletionsEndpoint, normalizeOpenAiCompatibleBaseUrl } from './openai-compatible-endpoint';

describe('OpenAI-compatible endpoint normalization', () => {
  it.each([
    ['https://openrouter.ai/api', 'https://openrouter.ai/api/v1'],
    ['https://openrouter.ai/api/v1', 'https://openrouter.ai/api/v1'],
    ['https://openrouter.ai/api/v1/chat/completions', 'https://openrouter.ai/api/v1'],
    ['http://localhost:5001/', 'http://localhost:5001/v1'],
  ])('normalizes %s to the API base URL', (endpoint, expected) => {
    expect(normalizeOpenAiCompatibleBaseUrl(endpoint)).toBe(expected);
  });

  it('builds a chat completions endpoint without duplicating v1', () => {
    expect(normalizeChatCompletionsEndpoint('https://openrouter.ai/api/v1')).toBe(
      'https://openrouter.ai/api/v1/chat/completions',
    );
  });
});
