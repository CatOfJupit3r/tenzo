import { describe, expect, it } from 'vitest';

import { createCharacterLanguageModel } from './ai-sdk-text-generation';

describe('AI SDK text generation', () => {
  it('advertises JSON Schema structured output support to compatible chat models', () => {
    const model = createCharacterLanguageModel({
      endpoint: 'http://localhost:5001',
      apiKey: '',
      model: 'local-model',
      topK: 0,
      minP: 0,
    });

    expect(Reflect.get(model, 'supportsStructuredOutputs')).toBe(true);
  });
});
