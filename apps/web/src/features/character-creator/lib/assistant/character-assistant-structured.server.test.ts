import { EventType } from '@tanstack/ai';
import type { ModelMessage, StreamChunk, UIMessage } from '@tanstack/ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createEmptyCharacterCard } from '../../constants/card-defaults';
import { TEMPLATE_FIELD_KEYS, TEMPLATE_MODES } from '../cards/field-templates';
import { DEFAULT_CHARACTER_ASSISTANT_FIELD_EDITING } from '../generation/generation-config';
import { createCharacterEditProposal } from '../proposals/character-edit-proposal';
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

  it('includes the global character instruction in the assistant system prompt', async () => {
    generateValidatedObjectMock.mockResolvedValue({
      assistantMessage: 'Understood.',
      actions: [],
      isDone: true,
      followUpSuggestions: [],
    });

    await collect(
      generateStructuredCharacterAssistantStream({
        ...createOptions(),
        globalCharacterInstruction: 'Favor tsundere dynamics while keeping each character distinct.',
      }),
    );

    expect(generateValidatedObjectMock).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining(
          'Global character instruction: Favor tsundere dynamics while keeping each character distinct.',
        ),
      }),
    );
  });

  it('defaults omitted structured round control fields', async () => {
    generateValidatedObjectMock.mockResolvedValue({
      assistantMessage: 'Understood.',
      actions: [],
      isDone: true,
      followUpSuggestions: [],
    });

    await collect(generateStructuredCharacterAssistantStream(createOptions()));

    const schema = generateValidatedObjectMock.mock.calls[0]?.[0].schema;
    expect(schema.parse({ assistantMessage: 'I am still working.' })).toEqual({
      assistantMessage: 'I am still working.',
      actions: [],
      isDone: false,
      followUpSuggestions: [],
    });
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

    expect(chunks.some((chunk) => chunk.type === EventType.TOOL_CALL_RESULT)).toBe(true);
  });

  it('repairs malformed JSON action arguments before validation', async () => {
    const options = createOptions();
    const proposedCard = structuredClone(options.card);
    proposedCard.data.description = 'A librarian who safeguards forgotten memories.';
    options.store.appendProposedCard.mockReturnValue(
      createCharacterEditProposal({ baseCard: options.card, proposedCard }) as never,
    );
    generateValidatedObjectMock.mockResolvedValueOnce({
      assistantMessage: 'I drafted the description.',
      actions: [
        {
          action: CHARACTER_ASSISTANT_TOOL_NAMES.propose_character_fields,
          inputJson: "{changes:[{fieldKey:'description',value:'A librarian who safeguards forgotten memories.'}]}",
        },
      ],
      isDone: true,
      followUpSuggestions: [],
    });

    const chunks = await collect(generateStructuredCharacterAssistantStream(options));

    expect(options.store.appendProposedCard).toHaveBeenCalledWith(
      expect.objectContaining({ summary: 'Character update' }),
    );
    expect(chunks.some((chunk) => chunk.type === EventType.TOOL_CALL_RESULT)).toBe(true);
  });

  it('completes without retrying when a proposal already matches the current card', async () => {
    const options = createOptions();
    options.store.appendProposedCard.mockReturnValue(
      createCharacterEditProposal({ baseCard: options.card, proposedCard: structuredClone(options.card) }) as never,
    );
    generateValidatedObjectMock.mockResolvedValueOnce({
      assistantMessage: 'The description already matches.',
      actions: [
        {
          action: CHARACTER_ASSISTANT_TOOL_NAMES.propose_character_fields,
          inputJson: JSON.stringify({
            changes: [{ fieldKey: 'description', value: options.card.data.description }],
          }),
        },
      ],
      isDone: true,
      followUpSuggestions: [],
    });

    const chunks = await collect(generateStructuredCharacterAssistantStream(options));
    const toolResult = chunks.find((chunk) => chunk.type === EventType.TOOL_CALL_END);

    expect(generateValidatedObjectMock).toHaveBeenCalledOnce();
    expect(toolResult).toEqual(
      expect.objectContaining({
        state: 'output-available',
        output: expect.objectContaining({ isNoOp: true, proposal: null }),
      }),
    );
    expect(chunks.at(-1)?.type).toBe(EventType.RUN_FINISHED);
  });

  it('returns a retryable tool error when a structured strict proposal drifts', async () => {
    const options = createOptions();
    const correctedCard = structuredClone(options.card);
    correctedCard.data.description = 'Description: A careful archivist.';
    options.store.appendProposedCard.mockReturnValue(
      createCharacterEditProposal({ baseCard: options.card, proposedCard: correctedCard }) as never,
    );
    const strictTemplate = {
      id: 'strict-description',
      name: 'Strict description',
      mode: TEMPLATE_MODES.strict,
      fieldKeys: [TEMPLATE_FIELD_KEYS.description],
      content: 'Description: {{gen:body}}',
    };
    generateValidatedObjectMock
      .mockResolvedValueOnce({
        assistantMessage: 'I drafted the description.',
        actions: [
          {
            action: CHARACTER_ASSISTANT_TOOL_NAMES.propose_character_fields,
            inputJson: JSON.stringify({
              changes: [{ fieldKey: 'description', value: 'A description without the required prefix.' }],
              summary: 'Draft description',
            }),
          },
        ],
        isDone: true,
        followUpSuggestions: [],
      })
      .mockResolvedValueOnce({
        assistantMessage: 'I corrected the description proposal.',
        actions: [
          {
            action: CHARACTER_ASSISTANT_TOOL_NAMES.propose_character_fields,
            inputJson: JSON.stringify({
              changes: [{ fieldKey: 'description', value: correctedCard.data.description }],
              summary: 'Draft description',
            }),
          },
        ],
        isDone: true,
        followUpSuggestions: [],
      });

    const chunks = await collect(
      generateStructuredCharacterAssistantStream({
        ...options,
        templates: [strictTemplate],
      }),
    );
    const toolError = chunks.find((chunk) => chunk.type === EventType.TOOL_CALL_END && chunk.state === 'output-error');

    expect(toolError).toEqual(
      expect.objectContaining({
        result: expect.stringContaining('Fill only {{gen:label}} slots'),
      }),
    );
    expect(generateValidatedObjectMock).toHaveBeenCalledTimes(2);
    expect(chunks.some((chunk) => chunk.type === EventType.TOOL_CALL_RESULT)).toBe(true);
  });

  it('rejects disabled fields before executing structured proposal actions', async () => {
    const options = createOptions();
    const correctedCard = structuredClone(options.card);
    correctedCard.data.name = 'Mira';
    options.store.appendProposedCard.mockReturnValue(
      createCharacterEditProposal({ baseCard: options.card, proposedCard: correctedCard }) as never,
    );
    generateValidatedObjectMock
      .mockResolvedValueOnce({
        assistantMessage: 'I drafted the description.',
        actions: [
          {
            action: CHARACTER_ASSISTANT_TOOL_NAMES.propose_character_fields,
            inputJson: JSON.stringify({
              changes: [{ fieldKey: 'description', value: 'A hidden change.' }],
              summary: 'Change description',
            }),
          },
        ],
        isDone: true,
        followUpSuggestions: [],
      })
      .mockResolvedValueOnce({
        assistantMessage: 'I proposed an enabled field instead.',
        actions: [
          {
            action: CHARACTER_ASSISTANT_TOOL_NAMES.propose_character_fields,
            inputJson: JSON.stringify({
              changes: [{ fieldKey: 'name', value: correctedCard.data.name }],
              summary: 'Change name',
            }),
          },
        ],
        isDone: true,
        followUpSuggestions: [],
      });

    const chunks = await collect(
      generateStructuredCharacterAssistantStream({
        ...options,
        fieldShouldAllowAssistantEditing: {
          ...DEFAULT_CHARACTER_ASSISTANT_FIELD_EDITING,
          description: false,
        },
      }),
    );
    const request = generateValidatedObjectMock.mock.calls[0]?.[0];
    const toolError = chunks.find((chunk) => chunk.type === EventType.TOOL_CALL_END && chunk.state === 'output-error');

    expect(request.system).not.toContain('name|description|');
    expect(toolError).toEqual(expect.objectContaining({ result: expect.stringContaining('Invalid option') }));
    expect(options.store.appendProposedCard).toHaveBeenCalledOnce();
    expect(generateValidatedObjectMock).toHaveBeenCalledTimes(2);
  });

  it('fails the run when proposal retries are exhausted', async () => {
    const options = createOptions();
    generateValidatedObjectMock.mockResolvedValue({
      assistantMessage: 'I drafted the description.',
      actions: [
        {
          action: CHARACTER_ASSISTANT_TOOL_NAMES.propose_character_fields,
          inputJson: JSON.stringify({
            changes: [{ fieldKey: 'description', value: 'Invalid structure.' }],
            summary: 'Draft description',
          }),
        },
      ],
      isDone: true,
      followUpSuggestions: [],
    });

    await expect(
      collect(
        generateStructuredCharacterAssistantStream({
          ...options,
          templates: [
            {
              id: 'strict-description',
              name: 'Strict description',
              mode: TEMPLATE_MODES.strict,
              fieldKeys: [TEMPLATE_FIELD_KEYS.description],
              content: 'Description: {{gen:body}}',
            },
          ],
        }),
      ),
    ).rejects.toThrow('did not produce a valid proposal');
    expect(generateValidatedObjectMock).toHaveBeenCalledTimes(MAX_STRUCTURED_ROUNDS);
  });
});
