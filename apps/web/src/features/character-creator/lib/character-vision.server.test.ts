import type { LanguageModel } from 'ai';
import { describe, expect, it, vi } from 'vitest';

import { analyzeCharacterImage } from './character-vision.server';

const { generateObjectMock, generateTextMock } = vi.hoisted(() => ({
  generateObjectMock: vi.fn(),
  generateTextMock: vi.fn(),
}));

vi.mock('ai', () => ({
  generateObject: generateObjectMock,
  generateText: generateTextMock,
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
const mockModel = {} as LanguageModel;

describe('character vision analysis', () => {
  it('returns a validated structured analysis', async () => {
    generateObjectMock.mockResolvedValueOnce({ object: analysis });

    await expect(analyzeCharacterImage(request, mockModel)).resolves.toEqual(analysis);
    expect(generateObjectMock).toHaveBeenCalledOnce();
  });

  it('falls back to JSON text and clamps oversized arrays', async () => {
    generateObjectMock.mockRejectedValueOnce(new Error('The endpoint returned invalid structured output.'));
    generateTextMock.mockResolvedValueOnce({
      text: JSON.stringify({ ...analysis, suggestedTags: Array.from({ length: 12 }, (_, index) => `tag-${index}`) }),
    });

    const result = await analyzeCharacterImage(request, mockModel);
    expect(result.suggestedTags).toHaveLength(10);
    expect(result).toMatchObject({
      suggestedTags: expect.arrayContaining(['tag-0', 'tag-9']),
    });
  });
});
