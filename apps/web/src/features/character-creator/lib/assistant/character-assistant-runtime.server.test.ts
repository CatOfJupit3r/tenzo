import { EventType } from '@tanstack/ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createEmptyCharacterCard } from '../../constants/card-defaults';
import { BUILT_IN_FIELD_TEMPLATES } from '../../constants/default-field-templates';
import { resolveEffectiveFieldTemplateId } from '../cards/field-template-resolution';
import { buildAssistantSystemPrompt, streamCharacterAssistant } from './character-assistant-runtime.server';

const { chatMock } = vi.hoisted(() => ({ chatMock: vi.fn() }));

vi.mock('@tanstack/ai', async () => ({
  ...(await vi.importActual<Record<string, unknown>>('@tanstack/ai')),
  chat: chatMock,
}));

beforeEach(() => {
  chatMock.mockReset();
  chatMock.mockReturnValue({
    async *[Symbol.asyncIterator]() {
      yield { type: EventType.RUN_STARTED, runId: 'test-run' };
    },
  });
});

describe('native character assistant tools', () => {
  it('runs the tool loop without a separate structured-output finalization request', () => {
    const card = createEmptyCharacterCard();

    streamCharacterAssistant({
      card,
      focus: { kind: 'card' },
      contextAttachments: [],
      apiKey: 'test-key',
      generationSettings: {
        endpoint: 'https://openrouter.ai/api/v1',
        model: 'test/model',
        openRouterProvider: 'nextbit',
        maxTokens: 2_000,
        temperature: 1,
        topP: 1,
        frequencyPenalty: 0,
        presencePenalty: 0,
        topK: 0,
        minP: 0,
      },
      store: {
        getCard: () => card,
        appendProposedCard: vi.fn(),
      },
      messages: [{ role: 'user', content: 'Propose a name.' }],
      maxSteps: 8,
    });

    expect(chatMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: expect.any(Array),
        stream: true,
      }),
    );
    expect(chatMock.mock.calls[0]?.[0]).not.toHaveProperty('outputSchema');
  });
});

describe('buildAssistantSystemPrompt', () => {
  it('includes reference characters, depth expectations, and focused field guidance', () => {
    const prompt = buildAssistantSystemPrompt({
      card: createEmptyCharacterCard(),
      focus: { kind: 'field', fieldKey: 'description' },
      contextAttachments: [],
      exampleCharacters: [{ name: 'Rin', description: 'A wandering swordswoman haunted by her past.' }],
      mode: 'tool-call',
    });

    expect(prompt).toContain('Reference characters');
    expect(prompt).toContain('Rin');
    expect(prompt).toContain('same depth and richness as dedicated field generation');
    expect(prompt).toContain('Field format guidance');
    expect(prompt).toContain('description:');
  });

  it('limits field guidance to the focused fields', () => {
    const prompt = buildAssistantSystemPrompt({
      card: createEmptyCharacterCard(),
      focus: { kind: 'field', fieldKey: 'first_mes' },
      contextAttachments: [],
      mode: 'tool-call',
    });

    expect(prompt).toContain('first_mes:');
    expect(prompt).not.toContain('mes_example:');
  });

  it('includes the effective built-in template when no explicit selection exists', () => {
    const templateId = resolveEffectiveFieldTemplateId({
      fieldTemplateIds: {},
      shouldUseDefaultFieldTemplates: true,
      targetKey: 'field:description',
    });
    const template = BUILT_IN_FIELD_TEMPLATES.find((candidate) => candidate.id === templateId);

    const prompt = buildAssistantSystemPrompt({
      card: createEmptyCharacterCard(),
      focus: { kind: 'field', fieldKey: 'description' },
      contextAttachments: [],
      templates: template ? [template] : [],
      mode: 'tool-call',
    });

    expect(template).toBeDefined();
    expect(prompt).toContain('Template: Structured Description');
    expect(prompt).toContain('Reproduce this skeleton exactly');
    expect(prompt).toContain('**Identity:** {{gen:identity:one line summing up who the character is}}');
  });

  it('includes guidance for every known field on card focus and omits the example section without references', () => {
    const prompt = buildAssistantSystemPrompt({
      card: createEmptyCharacterCard(),
      focus: { kind: 'card' },
      contextAttachments: [],
      mode: 'structured-output',
    });

    expect(prompt).toContain('description:');
    expect(prompt).toContain('first_mes:');
    expect(prompt).toContain('mes_example:');
    expect(prompt).not.toContain('Reference characters');
  });

  it('truncates reference context to the provided character budget', () => {
    const prompt = buildAssistantSystemPrompt({
      card: createEmptyCharacterCard(),
      focus: { kind: 'card' },
      contextAttachments: [],
      exampleCharacters: [{ name: 'Rin', description: 'A'.repeat(10_000) }],
      maxExampleContextCharacters: 2_500,
      mode: 'tool-call',
    });

    const exampleSectionStart = prompt.indexOf('Reference characters');
    expect(exampleSectionStart).toBeGreaterThanOrEqual(0);
    expect(prompt.slice(exampleSectionStart).length).toBeLessThan(10_000);
  });
});
