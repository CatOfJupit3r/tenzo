import { describe, expect, it } from 'vitest';

import type { iGenerateValidatedObject, iGenerateValidatedObjectOptions } from '../generation/structured-output.server';
import {
  createCharacterStructuredModelOptions,
  createCharacterTextAdapter,
} from '../generation/tanstack-ai-text-generation';
import { createCharacterDiscoveryDirectionsService } from './discovery-directions.server';
import type { iCharacterDiscoveryDirectionsDependencies } from './discovery-directions.server';

const generatedCards = {
  cards: [
    { title: 'First direction', description: 'A materially distinct direction with enough useful detail.' },
    { title: 'Second direction', description: 'Another materially distinct direction with enough useful detail.' },
    { title: 'Third direction', description: 'A final materially distinct direction with enough useful detail.' },
  ],
};

function createService() {
  const calls: iGenerateValidatedObjectOptions<unknown>[] = [];
  const adapter = createCharacterTextAdapter({
    endpoint: 'http://localhost:11434',
    apiKey: 'key',
    model: 'model',
  });
  const generateValidatedObject: iGenerateValidatedObject = async <T>(options: iGenerateValidatedObjectOptions<T>) => {
    calls.push(options as iGenerateValidatedObjectOptions<unknown>);
    return generatedCards as T;
  };
  const dependencies: iCharacterDiscoveryDirectionsDependencies = {
    generateValidatedObject,
    createTextAdapter: () => adapter,
    createStructuredModelOptions: createCharacterStructuredModelOptions,
  };
  return { calls, service: createCharacterDiscoveryDirectionsService(dependencies) };
}

describe('character discovery directions', () => {
  it('generates every category without requiring a premise', async () => {
    const { calls, service } = createService();

    const result = await service.generateCharacterDiscoveryDirections({
      endpoint: 'http://localhost:11434',
      apiKey: 'key',
      model: 'model',
      generationSettings: {
        maxTokens: 512,
        temperature: 0.7,
        topP: 1,
        frequencyPenalty: 0,
        presencePenalty: 0,
        topK: 0,
        minP: 0,
      },
    });

    expect(result.cards).toHaveLength(12);
    expect(calls).toHaveLength(4);
    expect(calls.every((options) => options.prompt?.includes('Invent varied premises'))).toBe(true);
  });
});
