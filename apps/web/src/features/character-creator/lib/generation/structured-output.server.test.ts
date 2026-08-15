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
const structuredOutputStream = vi.fn();
const adapter = { structuredOutputStream } as unknown as AnyTextAdapter;

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
        messages: [{ role: 'user', content: 'Create it.' }],
        systemPrompts: ['Generate a card.'],
        outputSchema: expect.any(Object),
        modelOptions: { max_tokens: 100, temperature: 0.5 },
        stream: false,
      }),
    );
    const structuredAdapter = chatMock.mock.calls[0]?.[0].adapter as AnyTextAdapter;
    expect(structuredAdapter).not.toBe(adapter);
    expect(structuredAdapter.structuredOutputStream).toBeUndefined();
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

  it('surfaces provider failures without retrying or changing generation modes', async () => {
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
    expect(chatMock).toHaveBeenCalledOnce();
  });

  it('surfaces nested provider details without inspecting request metadata', async () => {
    const providerError = Object.assign(new Error('Provider returned error'), {
      rawValue: { error: { message: 'Schema grammar rejected.', code: 'INVALID_SCHEMA' } },
    });
    chatMock.mockRejectedValue(providerError);

    await expect(
      generateValidatedObject({
        adapter,
        schema: RESPONSE_SCHEMA,
        schemaDescription: 'One test card.',
        system: 'Generate a card.',
        prompt: 'Create it.',
      }),
    ).rejects.toThrow('Schema grammar rejected. INVALID_SCHEMA');
  });
});
