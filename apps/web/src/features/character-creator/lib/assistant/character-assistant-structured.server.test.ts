import { EventType } from '@tanstack/ai';
import type { ModelMessage, StreamChunk, UIMessage } from '@tanstack/ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createEmptyCharacterCard } from '../../constants/card-defaults';
import { CHARACTER_ASSISTANT_FOCUS_KINDS, CHARACTER_ASSISTANT_TOOL_NAMES } from './character-assistant-contracts';
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
  createCharacterStructuredModelOptions: vi.fn(() => ({})),
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
    messages: [{ role: 'user' as const, content: 'Tell me about the current character.' }] as Array<
      ModelMessage | UIMessage
    >,
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
    expect(chunks.filter((chunk) => chunk.type === EventType.TEXT_MESSAGE_CONTENT)).toHaveLength(2);
    expect(
      chunks.some(
        (chunk) => chunk.type === EventType.TEXT_MESSAGE_CONTENT && chunk.delta === 'The concept is ready for review.',
      ),
    ).toBe(true);
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

  it('surfaces a later provider round failure', async () => {
    generateValidatedObjectMock
      .mockResolvedValueOnce({
        assistantMessage: 'The concept is recorded.',
        actions: [],
        isDone: false,
        followUpSuggestions: [],
      })
      .mockRejectedValueOnce(new Error('Provider returned error'));

    await expect(collect(generateStructuredCharacterAssistantStream(createOptions()))).rejects.toThrow(
      'Provider returned error',
    );
  });

  it('keeps only recent history for structured rounds', async () => {
    const options = createOptions();
    options.messages = Array.from({ length: 20 }, (_, index) => ({
      role: 'user' as const,
      content: `Message ${index}`,
    }));
    generateValidatedObjectMock.mockResolvedValueOnce({
      assistantMessage: 'Ready.',
      actions: [],
      isDone: true,
      followUpSuggestions: [],
    });

    await collect(generateStructuredCharacterAssistantStream(options));

    const messages = generateValidatedObjectMock.mock.calls[0]?.[0].messages;
    expect(messages).toHaveLength(12);
    expect(messages[0].content).toBe('Message 8');
    expect(messages.at(-1)?.content).toBe('Message 19');
  });

  it('keeps conversational text while dropping structured history payloads', async () => {
    const options = createOptions();
    options.messages = [
      {
        id: 'assistant-with-output',
        role: 'assistant',
        parts: [
          { type: 'text', content: 'Keep this summary.' },
          { type: 'structured-output', data: { cards: Array.from({ length: 100 }, () => 'large') } } as never,
        ],
      },
      { role: 'user', content: 'Continue from the summary.' },
    ];
    generateValidatedObjectMock.mockResolvedValueOnce({
      assistantMessage: 'Ready.',
      actions: [],
      isDone: true,
      followUpSuggestions: [],
    });

    await collect(generateStructuredCharacterAssistantStream(options));

    expect(generateValidatedObjectMock.mock.calls[0]?.[0].messages).toEqual([
      { role: 'assistant', content: 'Keep this summary.' },
      { role: 'user', content: 'Continue from the summary.' },
    ]);
  });

  it('validates and executes JSON-encoded actions for models without native tools', async () => {
    const options = createOptions();
    options.messages = [{ role: 'user', content: 'Create a librarian.' }];
    const concept = {
      premise: 'A librarian who safeguards memories that people chose to forget.',
      archetype: 'Reluctant keeper',
      keyTraits: ['observant'],
      flaws: ['secretive'],
      nameCandidates: ['Elian'],
      suggestedTags: ['fantasy'],
    };
    generateValidatedObjectMock.mockResolvedValueOnce({
      assistantMessage: 'I found a direction.',
      actions: [
        {
          action: CHARACTER_ASSISTANT_TOOL_NAMES.record_concept,
          inputJson: JSON.stringify({ action: CHARACTER_ASSISTANT_TOOL_NAMES.record_concept, ...concept }),
        },
      ],
      isDone: true,
      followUpSuggestions: [],
    });

    const chunks = await collect(generateStructuredCharacterAssistantStream(options));

    expect(options.store.recordConcept).toHaveBeenCalledWith(concept);
    expect(chunks.some((chunk) => chunk.type === EventType.TOOL_CALL_RESULT)).toBe(true);
  });
});
