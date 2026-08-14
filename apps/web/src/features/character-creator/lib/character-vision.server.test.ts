import type { AnyTextAdapter } from '@tanstack/ai';
import { describe, expect, it, vi } from 'vitest';

import { analyzeCharacterImage } from './character-vision.server';

const { generateValidatedObjectMock } = vi.hoisted(() => ({
  generateValidatedObjectMock: vi.fn(),
}));

vi.mock('./structured-output.server', () => ({
  generateValidatedObject: generateValidatedObjectMock,
}));

const request = {
  endpoint: 'http://localhost:1234',
  apiKey: 'key',
  model: 'vision-model',
  maxTokens: 300,
  temperature: 0.5,
  imageDataUrl: 'data:image/png;base64,aGVsbG8=',
};

const analysis = {
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
const mockAdapter = {} as AnyTextAdapter;

describe('character vision analysis', () => {
  it('returns a validated structured analysis', async () => {
    generateValidatedObjectMock.mockResolvedValueOnce(analysis);

    await expect(analyzeCharacterImage(request, mockAdapter)).resolves.toEqual(analysis);
    expect(generateValidatedObjectMock).toHaveBeenCalledOnce();
  });

  it('clamps oversized arrays returned by structured generation', async () => {
    generateValidatedObjectMock.mockResolvedValueOnce({
      ...analysis,
      suggestedTags: Array.from({ length: 12 }, (_, index) => `tag-${index}`),
    });

    const result = await analyzeCharacterImage(request, mockAdapter);
    expect(result.suggestedTags).toHaveLength(10);
    expect(result).toMatchObject({
      suggestedTags: expect.arrayContaining(['tag-0', 'tag-9']),
    });
  });
});
