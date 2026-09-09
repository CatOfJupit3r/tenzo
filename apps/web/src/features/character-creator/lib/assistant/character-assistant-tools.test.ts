import { describe, expect, it, vi } from 'vitest';

import {
  CHARACTER_ASSISTANT_FOCUS_KINDS_CASES,
  CHARACTER_ASSISTANT_TOOL_NAMES,
} from '@~/features/character-creator/lib/assistant/character-assistant-contracts';
import { CHARACTER_TEXT_FIELD_KEY } from '@~/features/character-creator/lib/cards/card-schema';

import { createEmptyCharacterCard } from '../../constants/card-defaults';
import type { TemplateFieldKey, TemplateMode } from '../cards/field-templates';
import { TEMPLATE_FIELD_KEYS, TEMPLATE_MODES } from '../cards/field-templates';
import { DEFAULT_CHARACTER_ASSISTANT_FIELD_EDITING } from '../generation/generation-config';
import type { iCharacterAssistantProposalStore } from './character-assistant-tools';
import {
  createCharacterAssistantActionHandlers,
  createCharacterAssistantTools,
  createProposalFromChanges,
  createProposeCharacterFieldsInputSchema,
  PROPOSE_CHARACTER_BOOK_INPUT_SCHEMA,
  PROPOSE_CUSTOM_FIELDS_INPUT_SCHEMA,
} from './character-assistant-tools';

function createStore(): iCharacterAssistantProposalStore & {
  appendProposedCard: ReturnType<typeof vi.fn>;
} {
  const card = createEmptyCharacterCard();
  const appendProposedCard = vi.fn(() => ({ patches: [{}] }) as never);
  return {
    getCard: () => card,
    appendProposedCard,
  };
}

function createTemplate(mode: TemplateMode, fieldKey: TemplateFieldKey) {
  return {
    id: `template-${mode}-${fieldKey}`,
    name: `${mode} ${fieldKey}`,
    mode,
    fieldKeys: [fieldKey],
    content: '<START>\n{{char}}: {{gen:opening}}\n{{user}}: {{gen:reply}}',
  };
}

describe('character assistant template enforcement', () => {
  it('defaults auxiliary proposal fields instead of rejecting usable tool calls', () => {
    expect(
      createProposeCharacterFieldsInputSchema()?.parse({
        changes: [{ fieldKey: 'description', value: 'A watchful archivist.' }],
      }),
    ).toEqual({
      changes: [{ fieldKey: 'description', value: 'A watchful archivist.' }],
      summary: 'Character update',
    });
    expect(PROPOSE_CUSTOM_FIELDS_INPUT_SCHEMA.parse({ fields: [{}] })).toEqual({
      fields: [{ label: 'Custom field', value: '' }],
      summary: 'Character update',
    });
    expect(PROPOSE_CHARACTER_BOOK_INPUT_SCHEMA.parse({ characterBook: { entries: [{}] } })).toEqual({
      characterBook: {
        entries: [{ keys: [], content: '', extensions: {}, enabled: true, insertion_order: 0 }],
        extensions: {},
      },
      summary: 'Character update',
    });
  });

  it('removes disabled fields and dedicated tools from native tool schemas', () => {
    const fieldShouldAllowAssistantEditing = {
      ...DEFAULT_CHARACTER_ASSISTANT_FIELD_EDITING,
      description: false,
      tags: false,
    };
    const characterFieldsSchema = createProposeCharacterFieldsInputSchema(fieldShouldAllowAssistantEditing);
    const tools = createCharacterAssistantTools({
      focus: { kind: CHARACTER_ASSISTANT_FOCUS_KINDS_CASES.CARD },
      store: createStore(),
      fieldShouldAllowAssistantEditing,
    });

    expect(
      characterFieldsSchema?.safeParse({
        changes: [{ fieldKey: 'description', value: 'Hidden change' }],
        summary: 'Change description',
      }).success,
    ).toBe(false);
    expect(
      characterFieldsSchema?.safeParse({
        changes: [{ fieldKey: 'name', value: 'Mira' }],
        summary: 'Change name',
      }).success,
    ).toBe(true);
    expect(tools).not.toHaveProperty(CHARACTER_ASSISTANT_TOOL_NAMES.PROPOSE_TAGS);
    expect(tools).toHaveProperty(CHARACTER_ASSISTANT_TOOL_NAMES.PROPOSE_CHARACTER_FIELDS);
  });

  it('returns a successful no-op when proposed values already match the card', () => {
    const store = createStore();
    store.appendProposedCard.mockReturnValue({ patches: [] } as never);

    expect(
      createProposalFromChanges({
        store,
        focus: { kind: CHARACTER_ASSISTANT_FOCUS_KINDS_CASES.CARD },
        summary: 'Keep the current name',
        fieldKeys: ['name'],
        updateCard: () => undefined,
      }),
    ).toEqual({
      proposal: null,
      isNoOp: true,
      message: 'No changes were needed because the requested fields already match the current card.',
    });
  });

  it('accepts a proposal that preserves a strict template skeleton', () => {
    const store = createStore();
    const handlers = createCharacterAssistantActionHandlers({
      focus: { kind: CHARACTER_ASSISTANT_FOCUS_KINDS_CASES.CARD },
      store,
      templates: [createTemplate(TEMPLATE_MODES.STRICT, TEMPLATE_FIELD_KEYS.DESCRIPTION)],
    });

    handlers.proposeCharacterFields({
      changes: [
        {
          fieldKey: CHARACTER_TEXT_FIELD_KEY.DESCRIPTION,
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
      focus: { kind: CHARACTER_ASSISTANT_FOCUS_KINDS_CASES.CARD },
      store,
      templates: [createTemplate(TEMPLATE_MODES.STRICT, TEMPLATE_FIELD_KEYS.DESCRIPTION)],
    });

    expect(() =>
      handlers.proposeCharacterFields({
        changes: [{ fieldKey: CHARACTER_TEXT_FIELD_KEY.DESCRIPTION, value: 'A description without the skeleton.' }],
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
      focus: { kind: CHARACTER_ASSISTANT_FOCUS_KINDS_CASES.CARD },
      store,
      templates: [createTemplate(TEMPLATE_MODES.PROMPT, TEMPLATE_FIELD_KEYS.DESCRIPTION)],
    });

    handlers.proposeCharacterFields({
      changes: [{ fieldKey: CHARACTER_TEXT_FIELD_KEY.DESCRIPTION, value: 'Free-form description guidance.' }],
      summary: 'Add a description',
    });

    expect(store.appendProposedCard).toHaveBeenCalledOnce();
  });

  it('maps strict alternate-greeting templates to every proposed greeting', () => {
    const store = createStore();
    const handlers = createCharacterAssistantActionHandlers({
      focus: { kind: CHARACTER_ASSISTANT_FOCUS_KINDS_CASES.CARD },
      store,
      templates: [createTemplate(TEMPLATE_MODES.STRICT, TEMPLATE_FIELD_KEYS.ALTERNATE_GREETING)],
    });

    expect(() =>
      handlers.proposeAlternateGreetings({
        greetings: ['<START>\nAssistant: Hello.\n{{user}}: Hi!'],
        summary: 'Add a greeting',
      }),
    ).toThrow('does not match strict template');
  });
});
