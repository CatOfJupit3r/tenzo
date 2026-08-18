import { EventType } from '@tanstack/ai';
import type { StreamChunk } from '@tanstack/ai';
import { describe, expect, it } from 'vitest';

import { createEmptyCharacterCard } from '../../constants/card-defaults';
import { BUILT_IN_FIELD_TEMPLATES } from '../../constants/default-field-templates';
import { resolveEffectiveFieldTemplateId } from '../cards/field-template-resolution';
import { DEFAULT_CHARACTER_ASSISTANT_FIELD_EDITING } from '../generation/generation-config';
import type { iCharacterChatOptions } from '../generation/tanstack-ai-text-generation';
import { CHARACTER_ASSISTANT_TOOL_NAMES } from './character-assistant-contracts';
import { buildAssistantSystemPrompt, createCharacterAssistantRuntime } from './character-assistant-runtime.server';
import type {
  iCharacterAssistantRuntimeService,
  iStreamCharacterAssistantOptions,
} from './character-assistant-runtime.server';

function createRuntimeHarness() {
  const calls: iCharacterChatOptions[] = [];
  const runtime: iCharacterAssistantRuntimeService = createCharacterAssistantRuntime({
    chat: (options) => {
      calls.push(options);
      return (async function* streamChunks(): AsyncGenerator<StreamChunk> {
        yield { type: EventType.RUN_STARTED, threadId: 'test-thread', runId: 'test-run' };
      })();
    },
  });
  return { calls, runtime };
}

function createOptions() {
  const card = createEmptyCharacterCard();
  const store: iStreamCharacterAssistantOptions['store'] = {
    getCard: () => card,
    appendProposedCard: () => {
      throw new Error('No proposal was expected in this fixture.');
    },
  };
  return {
    card,
    focus: { kind: 'card' } as const,
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
    store,
    messages: [{ role: 'user' as const, content: 'Propose a name.' }],
    maxSteps: 8,
  };
}

describe('native character assistant tools', () => {
  it('runs the tool loop without a separate structured-output finalization request', () => {
    const harness = createRuntimeHarness();

    harness.runtime.streamCharacterAssistant(createOptions());

    expect(harness.calls).toHaveLength(1);
    expect(harness.calls[0]).toEqual(
      expect.objectContaining({
        tools: expect.any(Array),
        stream: true,
      }),
    );
    expect(harness.calls[0]).not.toHaveProperty('outputSchema');
  });

  it('does not expose native tools for disabled dedicated fields', () => {
    const harness = createRuntimeHarness();
    const options = createOptions();

    harness.runtime.streamCharacterAssistant({
      ...options,
      fieldShouldAllowAssistantEditing: {
        ...DEFAULT_CHARACTER_ASSISTANT_FIELD_EDITING,
        alternate_greetings: false,
      },
      messages: [{ role: 'user', content: 'Propose greetings.' }],
    });

    const toolNames = harness.calls[0]?.tools?.map((tool) => tool.name);
    expect(toolNames).not.toContain(CHARACTER_ASSISTANT_TOOL_NAMES.propose_alternate_greetings);
    expect(toolNames).toContain(CHARACTER_ASSISTANT_TOOL_NAMES.propose_character_fields);
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
