import { describe, expect, it } from 'vitest';

import type { iGenerateValidatedObject, iGenerateValidatedObjectOptions } from '../generation/structured-output.server';
import {
  createCharacterStructuredModelOptions,
  createCharacterTextAdapter,
} from '../generation/tanstack-ai-text-generation';
import type { iCharacterImageAnalysis } from './character-vision-contracts';
import { createCharacterVisionService } from './character-vision.server';

const request = {
  endpoint: 'http://localhost:1234',
  apiKey: 'key',
  model: 'vision-model',
  maxTokens: 300,
  temperature: 0.5,
  imageDataUrl: 'data:image/png;base64,aGVsbG8=',
};

const analysis: iCharacterImageAnalysis = {
  subject: 'A person in a cloak.',
  appearance: {
    hair: 'Dark hair',
    eyes: 'Blue eyes',
    skin: 'Fair skin',
    build: 'Slender',
    age: 'Adult',
    notableFeatures: ['A silver pin'],
  },
  attire: 'A dark cloak',
  moodAndPose: 'Calm and watchful',
  artStyle: 'Painterly',
  paletteAndLighting: 'Cool moonlight',
  suggestedTags: ['cloak'],
  confidence: 0.8,
  warnings: [],
};

function createVisionHarness(value: unknown) {
  const calls: iGenerateValidatedObjectOptions<unknown>[] = [];
  const generateValidatedObject: iGenerateValidatedObject = async <T>(options: iGenerateValidatedObjectOptions<T>) => {
    calls.push(options as iGenerateValidatedObjectOptions<unknown>);
    return options.schema.parse(value);
  };
  const adapter = createCharacterTextAdapter({
    endpoint: request.endpoint,
    apiKey: request.apiKey,
    model: request.model,
  });
  return {
    calls,
    adapter,
    service: createCharacterVisionService({
      generateValidatedObject,
      createTextAdapter: () => adapter,
      createStructuredModelOptions: createCharacterStructuredModelOptions,
    }),
  };
}

describe('character vision analysis', () => {
  it('returns a validated structured analysis through an injected generator', async () => {
    const harness = createVisionHarness(analysis);

    await expect(harness.service.analyzeCharacterImage(request, harness.adapter)).resolves.toEqual(analysis);
    expect(harness.calls).toHaveLength(1);
  });

  it('clamps oversized arrays returned by structured generation', async () => {
    const harness = createVisionHarness({
      ...analysis,
      suggestedTags: Array.from({ length: 12 }, (_, index) => `tag-${index}`),
    });

    const result = await harness.service.analyzeCharacterImage(request, harness.adapter);
    expect(result.suggestedTags).toHaveLength(10);
    expect(result).toMatchObject({
      suggestedTags: expect.arrayContaining(['tag-0', 'tag-9']),
    });
  });
});
