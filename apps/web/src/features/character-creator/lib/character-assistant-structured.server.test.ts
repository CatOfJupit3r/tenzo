import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createEmptyCharacterCard } from '../constants/card-defaults';
import { GUIDED_STEP_IDS } from '../constants/guided-flow';
import { CHARACTER_ASSISTANT_FOCUS_KINDS } from './character-assistant-contracts';
import {
  createCharacterAssistantResponseSchema,
  generateStructuredCharacterAssistant,
} from './character-assistant-structured.server';
import {
  applyCharacterEditProposal,
  CHARACTER_EDIT_PATCH_STATUSES,
  CHARACTER_EDIT_PROPOSAL_STATUSES,
  createCharacterEditProposal,
  upsertCharacterEditProposal,
} from './character-edit-proposal';

const { generateValidatedObjectMock } = vi.hoisted(() => ({
  generateValidatedObjectMock: vi.fn(),
}));

vi.mock('./tanstack-ai-text-generation', () => ({
  createCharacterTextAdapter: vi.fn(() => ({})),
  createCharacterModelOptions: vi.fn(() => ({})),
}));

vi.mock('./structured-output.server', () => ({
  generateValidatedObject: generateValidatedObjectMock,
}));

const GENERATION_SETTINGS = {
  endpoint: 'http://localhost:5001',
  model: 'koboldcpp/test-model',
  maxTokens: 800,
  temperature: 0.7,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
  topK: 0,
  minP: 0,
};

beforeEach(() => {
  generateValidatedObjectMock.mockReset();
});

describe('structured character assistant', () => {
  it('accepts sparse changes so unchanged fields can be omitted', () => {
    const schema = createCharacterAssistantResponseSchema(['name', 'description']);

    expect(
      schema.parse({
        assistantMessage: 'The name is ready for review.',
        concept: null,
        changes: { name: 'Nera Voss' },
      }).changes,
    ).toEqual({ name: 'Nera Voss' });
  });

  it('creates, applies, and settles a guided concept proposal end to end', async () => {
    generateValidatedObjectMock.mockResolvedValueOnce({
      assistantMessage: 'Nera is ready for review.',
      concept: {
        premise: 'A lighthouse keeper guides lost spirits home.',
        archetype: 'Haunted guide',
        keyTraits: ['compassionate', 'guarded'],
        flaws: ['unable to release one spirit'],
        nameCandidates: ['Nera Voss'],
        suggestedTags: ['lighthouse keeper', 'spirit guide'],
      },
      changes: {
        name: 'Nera Voss',
        tags: ['lighthouse keeper', 'spirit guide'],
      },
    });
    const baseCard = createEmptyCharacterCard();
    const result = await generateStructuredCharacterAssistant({
      card: baseCard,
      focus: {
        kind: CHARACTER_ASSISTANT_FOCUS_KINDS.fields,
        fieldKeys: ['name', 'tags'],
      },
      contextAttachments: [],
      apiKey: 'key',
      generationSettings: GENERATION_SETTINGS,
      guidedStep: GUIDED_STEP_IDS.concept,
      messages: [{ role: 'user', content: 'Create Nera Voss, a haunted lighthouse keeper.' }],
    });
    const proposal = createCharacterEditProposal({
      characterId: 'character-1',
      baseCard,
      proposedCard: result.proposedCard,
      summary: result.summary,
    });
    const applyResult = applyCharacterEditProposal(proposal, baseCard);
    const reconciledProposals = upsertCharacterEditProposal([proposal], applyResult.proposal);

    expect(result.concept?.nameCandidates).toEqual(['Nera Voss']);
    expect(result.hasChanges).toBe(true);
    expect(proposal.patches.map((patch) => patch.fieldKey)).toEqual(['name', 'tags']);
    expect(applyResult.card.data.name).toBe('Nera Voss');
    expect(applyResult.card.data.tags).toEqual(['lighthouse keeper', 'spirit guide']);
    expect(reconciledProposals[0]?.status).toBe(CHARACTER_EDIT_PROPOSAL_STATUSES.applied);
    expect(
      reconciledProposals[0]?.patches.every((patch) => patch.status === CHARACTER_EDIT_PATCH_STATUSES.applied),
    ).toBe(true);
  });

  it('ignores out-of-scope model fields and preserves null fields', async () => {
    generateValidatedObjectMock.mockResolvedValueOnce({
      assistantMessage: 'The appearance is ready for review.',
      concept: null,
      changes: {
        description: null,
        name: 'Out-of-scope name',
      },
    });
    const baseCard = createEmptyCharacterCard();
    baseCard.data.name = 'Existing name';
    baseCard.data.description = 'Existing description';

    const result = await generateStructuredCharacterAssistant({
      card: baseCard,
      focus: {
        kind: CHARACTER_ASSISTANT_FOCUS_KINDS.field,
        fieldKey: 'description',
      },
      contextAttachments: [],
      apiKey: 'key',
      generationSettings: GENERATION_SETTINGS,
      guidedStep: GUIDED_STEP_IDS.appearance,
      messages: [{ role: 'user', content: 'Keep the current appearance.' }],
    });

    expect(result.hasChanges).toBe(false);
    expect(result.proposedCard.data.name).toBe('Existing name');
    expect(result.proposedCard.data.description).toBe('Existing description');
  });

  it('preserves the character book when sparse changes omit it', async () => {
    generateValidatedObjectMock.mockResolvedValueOnce({
      assistantMessage: 'No character changes are needed.',
      concept: null,
      changes: {},
    });
    const baseCard = createEmptyCharacterCard();
    baseCard.data.character_book = {
      name: 'Existing lore',
      extensions: {},
      entries: [],
    };

    const result = await generateStructuredCharacterAssistant({
      card: baseCard,
      focus: { kind: CHARACTER_ASSISTANT_FOCUS_KINDS.card },
      contextAttachments: [],
      apiKey: 'key',
      generationSettings: GENERATION_SETTINGS,
      messages: [{ role: 'user', content: 'Review the character without making changes.' }],
    });

    expect(result.hasChanges).toBe(false);
    expect(result.proposedCard.data.character_book).toEqual(baseCard.data.character_book);
  });

  it('supports dialogue, custom fields, and character-book edits without replacing unrelated card data', async () => {
    generateValidatedObjectMock.mockResolvedValueOnce({
      assistantMessage: 'Dialogue and supporting details are ready for review.',
      concept: null,
      changes: {
        first_mes: 'The dream road moved again, {{user}}. Bring a lantern.',
        alternate_greetings: ['You found my map. That means it found you first.'],
        custom_fields: [{ label: 'Dream ink', value: 'Glows near unstable roads.' }],
        character_book: {
          shouldChange: true,
          value: {
            name: 'Dream roads',
            extensions: {},
            entries: [],
          },
        },
      },
    });
    const baseCard = createEmptyCharacterCard();
    baseCard.data.description = 'Existing appearance.';

    const result = await generateStructuredCharacterAssistant({
      card: baseCard,
      focus: {
        kind: CHARACTER_ASSISTANT_FOCUS_KINDS.fields,
        fieldKeys: ['first_mes', 'alternate_greetings', 'custom_fields', 'character_book'],
      },
      contextAttachments: [],
      apiKey: 'key',
      generationSettings: GENERATION_SETTINGS,
      messages: [{ role: 'user', content: 'Add dialogue and dream-road details.' }],
    });

    expect(result.proposedCard.data.first_mes).toContain('{{user}}');
    expect(result.proposedCard.data.alternate_greetings).toHaveLength(1);
    expect(result.proposedCard.data.extensions.custom_fields[0]).toMatchObject({
      label: 'Dream ink',
      value: 'Glows near unstable roads.',
    });
    expect(result.proposedCard.data.extensions.custom_fields[0]?.id).toBeTruthy();
    expect(result.proposedCard.data.character_book?.name).toBe('Dream roads');
    expect(result.proposedCard.data.description).toBe('Existing appearance.');
  });
});
