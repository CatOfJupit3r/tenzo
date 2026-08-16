import { describe, expect, it, vi } from 'vitest';

import { createEmptyCharacterCard } from '../../constants/card-defaults';
import { TEMPLATE_FIELD_KEYS, TEMPLATE_MODES } from '../cards/field-templates';
import { CHARACTER_ASSISTANT_FOCUS_KINDS } from './character-assistant-contracts';
import { createCharacterAssistantActionHandlers } from './character-assistant-tools';
import type { iCharacterAssistantProposalStore } from './character-assistant-tools';

function createStore(): iCharacterAssistantProposalStore & {
  appendProposedCard: ReturnType<typeof vi.fn>;
} {
  const card = createEmptyCharacterCard();
  const appendProposedCard = vi.fn(() => ({}) as never);
  return {
    getCard: () => card,
    appendProposedCard,
  };
}

function createTemplate(mode: 'prompt' | 'strict', fieldKey: 'description' | 'alternate_greeting') {
  return {
    id: `template-${mode}-${fieldKey}`,
    name: `${mode} ${fieldKey}`,
    mode,
    fieldKeys: [fieldKey],
    content: '<START>\n{{char}}: {{gen:opening}}\n{{user}}: {{gen:reply}}',
  };
}

describe('character assistant template enforcement', () => {
  it('accepts a proposal that preserves a strict template skeleton', () => {
    const store = createStore();
    const handlers = createCharacterAssistantActionHandlers({
      focus: { kind: CHARACTER_ASSISTANT_FOCUS_KINDS.card },
      store,
      templates: [createTemplate(TEMPLATE_MODES.strict, TEMPLATE_FIELD_KEYS.description)],
    });

    handlers.proposeCharacterFields({
      changes: [
        {
          fieldKey: 'description',
          value: '<START>\n{{char}}: A careful archivist.\n{{user}}: I need your help.',
        },
      ],
      summary: 'Add a description',
    });

    expect(store.appendProposedCard).toHaveBeenCalledOnce();
  });

  it('rejects strict skeleton drift with a retryable descriptive error', () => {
    const store = createStore();
    const handlers = createCharacterAssistantActionHandlers({
      focus: { kind: CHARACTER_ASSISTANT_FOCUS_KINDS.card },
      store,
      templates: [createTemplate(TEMPLATE_MODES.strict, TEMPLATE_FIELD_KEYS.description)],
    });

    expect(() =>
      handlers.proposeCharacterFields({
        changes: [{ fieldKey: 'description', value: 'A description without the skeleton.' }],
        summary: 'Add a description',
      }),
    ).toThrow(
      '<START>\n{{char}}: {{gen:opening}}\n{{user}}: {{gen:reply}}\nFill only {{gen:label}} slots; do not alter the literal text outside those slots.',
    );
    expect(store.appendProposedCard).not.toHaveBeenCalled();
  });

  it('does not reject prompt-mode templates', () => {
    const store = createStore();
    const handlers = createCharacterAssistantActionHandlers({
      focus: { kind: CHARACTER_ASSISTANT_FOCUS_KINDS.card },
      store,
      templates: [createTemplate(TEMPLATE_MODES.prompt, TEMPLATE_FIELD_KEYS.description)],
    });

    handlers.proposeCharacterFields({
      changes: [{ fieldKey: 'description', value: 'Free-form description guidance.' }],
      summary: 'Add a description',
    });

    expect(store.appendProposedCard).toHaveBeenCalledOnce();
  });

  it('maps strict alternate-greeting templates to every proposed greeting', () => {
    const store = createStore();
    const handlers = createCharacterAssistantActionHandlers({
      focus: { kind: CHARACTER_ASSISTANT_FOCUS_KINDS.card },
      store,
      templates: [createTemplate(TEMPLATE_MODES.strict, TEMPLATE_FIELD_KEYS.alternate_greeting)],
    });

    expect(() =>
      handlers.proposeAlternateGreetings({
        greetings: ['<START>\nAssistant: Hello.\n{{user}}: Hi!'],
        summary: 'Add a greeting',
      }),
    ).toThrow('does not match strict template');
  });
});
