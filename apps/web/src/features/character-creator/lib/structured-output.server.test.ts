import type { LanguageModel } from 'ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { extractFirstJsonValue, generateValidatedObject } from './structured-output.server';

const { generateTextMock } = vi.hoisted(() => ({
  generateTextMock: vi.fn(),
}));

vi.mock('ai', () => ({
  extractJsonMiddleware: vi.fn(() => 'json-middleware'),
  generateText: generateTextMock,
  Output: {
    object: vi.fn(() => 'object-output'),
  },
  wrapLanguageModel: vi.fn(({ model }: { model: unknown }) => model),
}));

const RESPONSE_SCHEMA = z.object({
  cards: z.array(z.object({ title: z.string() })).length(1),
});
const model = {} as Exclude<LanguageModel, string>;

beforeEach(() => {
  generateTextMock.mockReset();
});

describe('structured output generation', () => {
  it('extracts the first complete JSON value from fenced or prefaced text', () => {
    expect(extractFirstJsonValue('Result:\n```json\n{"cards":[{"title":"A } inside text"}]}\n```')).toBe(
      '{"cards":[{"title":"A } inside text"}]}',
    );
  });

  it('skips non-JSON bracketed prose before the response', () => {
    expect(extractFirstJsonValue('[JSON response]\n{"cards":[{"title":"Card"}]}')).toBe('{"cards":[{"title":"Card"}]}');
  });

  it('uses validated structured output when the provider supports it', async () => {
    const structuredValue = { cards: [{ title: 'Structured card' }] };
    generateTextMock.mockResolvedValueOnce({ output: structuredValue });

    await expect(
      generateValidatedObject({
        model,
        schema: RESPONSE_SCHEMA,
        schemaName: 'test_cards',
        schemaDescription: 'One test card.',
        system: 'Generate a card.',
        prompt: 'Create it.',
        maxOutputTokens: 100,
        temperature: 0.5,
      }),
    ).resolves.toEqual(structuredValue);
    expect(generateTextMock).toHaveBeenCalledOnce();
  });

  it('falls back to extracted and validated JSON text', async () => {
    generateTextMock
      .mockRejectedValueOnce(new Error('Structured response format is unsupported.'))
      .mockResolvedValueOnce({ text: 'Here is the result:\n```json\n{"cards":[{"title":"Fallback card"}]}\n```' });

    await expect(
      generateValidatedObject({
        model,
        schema: RESPONSE_SCHEMA,
        schemaName: 'test_cards',
        schemaDescription: 'One test card.',
        system: 'Generate a card.',
        prompt: 'Create it.',
        maxOutputTokens: 100,
        temperature: 0.5,
      }),
    ).resolves.toEqual({ cards: [{ title: 'Fallback card' }] });
    expect(generateTextMock).toHaveBeenCalledTimes(2);
  });

  it('surfaces the provider response body when both structured attempts fail', async () => {
    const providerError = Object.assign(new Error('Provider returned error'), {
      responseBody: '{"error":{"message":"No endpoints match the requested data policy."}}',
    });
    generateTextMock.mockRejectedValue(providerError);

    await expect(
      generateValidatedObject({
        model,
        schema: RESPONSE_SCHEMA,
        schemaName: 'test_cards',
        schemaDescription: 'One test card.',
        system: 'Generate a card.',
        prompt: 'Create it.',
        maxOutputTokens: 100,
        temperature: 0.5,
      }),
    ).rejects.toThrow('No endpoints match the requested data policy.');
  });
});
