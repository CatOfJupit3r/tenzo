import type { AnyTextAdapter } from '@tanstack/ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { generateValidatedObject } from './structured-output.server';

const { chatMock } = vi.hoisted(() => ({
  chatMock: vi.fn(),
}));

vi.mock('@tanstack/ai', async () => ({
  ...(await vi.importActual<Record<string, unknown>>('@tanstack/ai')),
  chat: chatMock,
}));

const RESPONSE_SCHEMA = z.object({
  cards: z.array(z.object({ title: z.string() })).length(1),
});
const adapter = {} as AnyTextAdapter;

beforeEach(() => {
  chatMock.mockReset();
});

describe('structured output generation', () => {
  it('uses TanStack AI native schema-backed output', async () => {
    const structuredValue = { cards: [{ title: 'Structured card' }] };
    chatMock.mockResolvedValueOnce(structuredValue);

    await expect(
      generateValidatedObject({
        adapter,
        schema: RESPONSE_SCHEMA,
        schemaDescription: 'One test card.',
        system: 'Generate a card.',
        prompt: 'Create it.',
        modelOptions: { max_tokens: 100, temperature: 0.5 },
      }),
    ).resolves.toEqual(structuredValue);
    expect(chatMock).toHaveBeenCalledWith(
      expect.objectContaining({
        adapter,
        messages: [{ role: 'user', content: 'Create it.' }],
        systemPrompts: ['Generate a card.'],
        outputSchema: expect.any(Object),
        modelOptions: { max_tokens: 100, temperature: 0.5 },
      }),
    );
  });

  it('requires either prompt text or messages', async () => {
    await expect(
      generateValidatedObject({
        adapter,
        schema: RESPONSE_SCHEMA,
        schemaDescription: 'One test card.',
        system: 'Generate a card.',
      }),
    ).rejects.toThrow('requires a prompt or messages');
    expect(chatMock).not.toHaveBeenCalled();
  });

  it('falls back to extracted JSON through TanStack AI for compatible servers without response formats', async () => {
    chatMock
      .mockRejectedValueOnce(new Error('Structured output is unsupported.'))
      .mockResolvedValueOnce('Result:\n```json\n{"cards":[{"title":"Fallback card"}]}\n```');

    await expect(
      generateValidatedObject({
        adapter,
        schema: RESPONSE_SCHEMA,
        schemaDescription: 'One test card.',
        system: 'Generate a card.',
        prompt: 'Create it.',
      }),
    ).resolves.toEqual({ cards: [{ title: 'Fallback card' }] });
    expect(chatMock).toHaveBeenLastCalledWith(expect.objectContaining({ stream: false }));
  });

  it('surfaces provider failures from both attempts', async () => {
    chatMock.mockRejectedValue(new Error('Provider rejected structured output.'));

    await expect(
      generateValidatedObject({
        adapter,
        schema: RESPONSE_SCHEMA,
        schemaDescription: 'One test card.',
        system: 'Generate a card.',
        prompt: 'Create it.',
      }),
    ).rejects.toThrow('Provider rejected structured output.');
  });
});
