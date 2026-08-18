import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createValidatedObjectGenerator } from './structured-output.server';
import type { iStructuredOutputChat, iStructuredOutputChatOptions } from './structured-output.server';
import { createCharacterTextAdapter } from './tanstack-ai-text-generation';

const RESPONSE_SCHEMA = z.object({
  cards: z.array(z.object({ title: z.string() })).length(1),
});

function createHarness() {
  const calls: iStructuredOutputChatOptions[] = [];
  let response: unknown = { cards: [{ title: 'Structured card' }] };
  let failure: unknown;
  const chatDependency: iStructuredOutputChat = async (options) => {
    calls.push(options);
    if (failure !== undefined) {
      throw failure;
    }
    return response;
  };

  return {
    calls,
    setFailure(value: unknown) {
      failure = value;
    },
    setResponse(value: unknown) {
      response = value;
    },
    generateValidatedObject: createValidatedObjectGenerator(chatDependency),
    adapter: createCharacterTextAdapter({
      endpoint: 'http://localhost:11434',
      apiKey: 'key',
      model: 'model',
    }),
  };
}

describe('structured output generation', () => {
  it('uses TanStack AI native schema-backed output', async () => {
    const harness = createHarness();
    const structuredValue = { cards: [{ title: 'Structured card' }] };
    harness.setResponse(structuredValue);

    await expect(
      harness.generateValidatedObject({
        adapter: harness.adapter,
        schema: RESPONSE_SCHEMA,
        schemaDescription: 'One test card.',
        system: 'Generate a card.',
        prompt: 'Create it.',
        modelOptions: { max_tokens: 100, temperature: 0.5 },
      }),
    ).resolves.toEqual(structuredValue);
    expect(harness.calls).toHaveLength(1);
    expect(harness.calls[0]).toEqual(
      expect.objectContaining({
        messages: [{ role: 'user', content: 'Create it.' }],
        systemPrompts: ['Generate a card.'],
        outputSchema: expect.any(Object),
        modelOptions: { max_tokens: 100, temperature: 0.5 },
        stream: false,
      }),
    );
    const structuredAdapter = harness.calls[0]?.adapter;
    expect(structuredAdapter).not.toBe(harness.adapter);
    expect(structuredAdapter.structuredOutputStream).toBeUndefined();
  });

  it('requires either prompt text or messages', async () => {
    const harness = createHarness();

    await expect(
      harness.generateValidatedObject({
        adapter: harness.adapter,
        schema: RESPONSE_SCHEMA,
        schemaDescription: 'One test card.',
        system: 'Generate a card.',
      }),
    ).rejects.toThrow('requires a prompt or messages');
    expect(harness.calls).toHaveLength(0);
  });

  it('surfaces provider failures without retrying or changing generation modes', async () => {
    const harness = createHarness();
    harness.setFailure(new Error('Provider rejected structured output.'));

    await expect(
      harness.generateValidatedObject({
        adapter: harness.adapter,
        schema: RESPONSE_SCHEMA,
        schemaDescription: 'One test card.',
        system: 'Generate a card.',
        prompt: 'Create it.',
      }),
    ).rejects.toThrow('Provider rejected structured output.');
    expect(harness.calls).toHaveLength(1);
  });

  it('surfaces nested provider details without inspecting request metadata', async () => {
    const harness = createHarness();
    const providerError = Object.assign(new Error('Provider returned error'), {
      rawValue: { error: { message: 'Schema grammar rejected.', code: 'INVALID_SCHEMA' } },
    });
    harness.setFailure(providerError);

    await expect(
      harness.generateValidatedObject({
        adapter: harness.adapter,
        schema: RESPONSE_SCHEMA,
        schemaDescription: 'One test card.',
        system: 'Generate a card.',
        prompt: 'Create it.',
      }),
    ).rejects.toThrow(/Schema grammar rejected\..*INVALID_SCHEMA/);
  });
});
