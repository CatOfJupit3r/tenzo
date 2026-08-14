import { EventType } from '@tanstack/ai';
import type { StreamChunk } from '@tanstack/ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createEmptyCharacterCard } from '../../constants/card-defaults';
import { CHARACTER_ASSISTANT_FOCUS_KINDS } from './character-assistant-contracts';
import {
  generateStructuredCharacterAssistantStream,
  MAX_STRUCTURED_ROUNDS,
} from './character-assistant-structured.server';

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

function createOptions() {
  const card = createEmptyCharacterCard();
  return {
    card,
    focus: { kind: CHARACTER_ASSISTANT_FOCUS_KINDS.card } as const,
    contextAttachments: [],
    apiKey: 'key',
    generationSettings: {
      endpoint: 'http://localhost:11434',
      model: 'model',
      maxTokens: 512,
      temperature: 0.7,
      topP: 1,
      frequencyPenalty: 0,
      presencePenalty: 0,
      topK: 0,
      minP: 0,
    },
    messages: [{ role: 'user' as const, content: 'Create a librarian.' }],
    store: {
      getCard: () => card,
      appendProposedCard: vi.fn(() => {
        throw new Error('No proposal was expected in this fixture.');
      }),
      recordConcept: vi.fn(),
      suggestDirections: vi.fn(),
    },
  };
}

async function collect(stream: AsyncIterable<StreamChunk>) {
  const chunks: StreamChunk[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return chunks;
}

describe('structured character assistant loop', () => {
  beforeEach(() => {
    generateValidatedObjectMock.mockReset();
  });

  it('continues after a prose-only incomplete round', async () => {
    generateValidatedObjectMock
      .mockResolvedValueOnce({
        assistantMessage: 'I will establish the concept first.',
        actions: [],
        isDone: false,
        followUpSuggestions: [],
      })
      .mockResolvedValueOnce({
        assistantMessage: 'The concept is ready for review.',
        actions: [],
        isDone: true,
        followUpSuggestions: ['Develop her voice'],
      });

    const chunks = await collect(generateStructuredCharacterAssistantStream(createOptions()));

    expect(generateValidatedObjectMock).toHaveBeenCalledTimes(2);
    expect(chunks.filter((chunk) => chunk.type === EventType.TEXT_MESSAGE_CONTENT)).toHaveLength(3);
    expect(chunks.at(-1)?.type).toBe(EventType.RUN_FINISHED);
  });

  it('stops at the configured round cap when the model never completes', async () => {
    generateValidatedObjectMock.mockResolvedValue({
      assistantMessage: 'Continuing.',
      actions: [],
      isDone: false,
      followUpSuggestions: [],
    });

    const chunks = await collect(generateStructuredCharacterAssistantStream(createOptions()));

    expect(generateValidatedObjectMock).toHaveBeenCalledTimes(MAX_STRUCTURED_ROUNDS);
    expect(chunks.at(-1)?.type).toBe(EventType.RUN_FINISHED);
  });
});
