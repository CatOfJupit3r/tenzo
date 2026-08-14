import { describe, expect, it, vi } from 'vitest';

import { generateCharacterDiscoveryDirections } from './discovery-directions.server';

const { generateValidatedObjectMock } = vi.hoisted(() => ({
  generateValidatedObjectMock: vi.fn(),
}));

vi.mock('../generation/structured-output.server', () => ({
  generateValidatedObject: generateValidatedObjectMock,
}));

vi.mock('../generation/tanstack-ai-text-generation', () => ({
  createCharacterTextAdapter: vi.fn(() => ({})),
  createCharacterModelOptions: vi.fn(() => ({})),
}));

describe('character discovery directions', () => {
  it('generates every category without requiring a premise', async () => {
    generateValidatedObjectMock.mockResolvedValue({
      cards: [
        { title: 'First direction', description: 'A materially distinct direction with enough useful detail.' },
        { title: 'Second direction', description: 'Another materially distinct direction with enough useful detail.' },
        { title: 'Third direction', description: 'A final materially distinct direction with enough useful detail.' },
      ],
    });

    const result = await generateCharacterDiscoveryDirections({
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
    expect(generateValidatedObjectMock).toHaveBeenCalledTimes(4);
    expect(
      generateValidatedObjectMock.mock.calls.every(([options]) => options.prompt.includes('Invent varied premises')),
    ).toBe(true);
  });
});
