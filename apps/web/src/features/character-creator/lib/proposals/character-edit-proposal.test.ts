import { describe, expect, it } from 'vitest';

import { createEmptyCharacterCard } from '../../constants/card-defaults';
import { DEFAULT_CHARACTER_ASSISTANT_FIELD_EDITING } from '../generation/generation-config';
import {
  applyCharacterEditProposal,
  CHARACTER_EDIT_PATCH_STATUSES,
  CHARACTER_EDIT_PROPOSAL_STATUSES,
  createCharacterCardRevision,
  createCharacterEditProposal,
  createCharacterEditPatches,
  preserveAssistantProtectedFields,
  reduceCharacterEditProposal,
  supersedeOverlappingCharacterEditProposals,
  upsertCharacterEditProposal,
} from './character-edit-proposal';

describe('character edit proposals', () => {
  it('preserves fields disabled for assistant editing', () => {
    const currentCard = createEmptyCharacterCard();
    currentCard.data.system_prompt = 'Keep this prompt.';
    currentCard.data.post_history_instructions = 'Keep these instructions.';
    currentCard.data.extensions.custom_fields = [{ id: 'voice', label: 'Voice', value: 'Warm' }];
    const proposedCard = structuredClone(currentCard);
    proposedCard.data.name = 'Mira';
    proposedCard.data.system_prompt = 'Overwrite prompt.';
    proposedCard.data.post_history_instructions = 'Overwrite instructions.';
    proposedCard.data.extensions.custom_fields = [];

    const permittedCard = preserveAssistantProtectedFields(currentCard, proposedCard, {
      ...DEFAULT_CHARACTER_ASSISTANT_FIELD_EDITING,
      system_prompt: false,
      post_history_instructions: false,
      custom_fields: false,
    });

    expect(permittedCard.data.name).toBe('Mira');
    expect(permittedCard.data.system_prompt).toBe('Keep this prompt.');
    expect(permittedCard.data.post_history_instructions).toBe('Keep these instructions.');
    expect(permittedCard.data.extensions.custom_fields).toEqual(currentCard.data.extensions.custom_fields);
  });

  it('creates typed patches for every field-addressable card section', () => {
    const baseCard = createEmptyCharacterCard();
    const proposedCard = structuredClone(baseCard);
    proposedCard.data.name = 'Mira';
    proposedCard.data.tags = ['mage'];
    proposedCard.data.alternate_greetings = ['Welcome.'];
    proposedCard.data.extensions.custom_fields = [{ id: 'voice', label: 'Voice', value: 'Warm' }];
    proposedCard.data.character_book = { extensions: {}, entries: [] };

    const patches = createCharacterEditPatches(baseCard, proposedCard);

    expect(patches.map((patch) => patch.fieldKey)).toEqual([
      'name',
      'tags',
      'alternate_greetings',
      'custom_fields',
      'character_book',
    ]);
    expect(patches.every((patch) => patch.status === CHARACTER_EDIT_PATCH_STATUSES.proposed)).toBe(true);
  });

  it('creates the same revision for semantically identical object key order', () => {
    const card = createEmptyCharacterCard();
    card.data.extensions.first = { beta: 2, alpha: 1 };
    const reorderedCard = structuredClone(card);
    reorderedCard.data.extensions.first = { alpha: 1, beta: 2 };

    expect(createCharacterCardRevision(card)).toBe(createCharacterCardRevision(reorderedCard));
  });

  it('applies selected non-conflicting patches and settles their lifecycle', () => {
    const baseCard = createEmptyCharacterCard();
    const proposedCard = structuredClone(baseCard);
    proposedCard.data.name = 'Mira';
    proposedCard.data.description = 'A wandering cartographer.';
    const proposal = createCharacterEditProposal({ baseCard, proposedCard });

    const result = applyCharacterEditProposal(proposal, baseCard, ['name']);

    expect(result.conflictFieldKeys).toEqual([]);
    expect(result.card.data.name).toBe('Mira');
    expect(result.card.data.description).toBe('');
    expect(result.proposal.status).toBe(CHARACTER_EDIT_PROPOSAL_STATUSES.review);
    expect(result.proposal.patches.find((patch) => patch.fieldKey === 'name')?.status).toBe(
      CHARACTER_EDIT_PATCH_STATUSES.applied,
    );
  });

  it('detects field-level conflicts without overwriting human changes', () => {
    const baseCard = createEmptyCharacterCard();
    const proposedCard = structuredClone(baseCard);
    proposedCard.data.description = 'Agent description';
    const currentCard = structuredClone(baseCard);
    currentCard.data.description = 'Human description';
    const proposal = createCharacterEditProposal({ baseCard, proposedCard });

    const result = applyCharacterEditProposal(proposal, currentCard);

    expect(result.conflictFieldKeys).toEqual(['description']);
    expect(result.card).toBe(currentCard);
    expect(result.card.data.description).toBe('Human description');
    expect(result.proposal.status).toBe(CHARACTER_EDIT_PROPOSAL_STATUSES.conflict);
    expect(result.proposal.patches[0]?.status).toBe(CHARACTER_EDIT_PATCH_STATUSES.conflict);
  });

  it('treats an already-applied value as an idempotent success', () => {
    const baseCard = createEmptyCharacterCard();
    const proposedCard = structuredClone(baseCard);
    proposedCard.data.name = 'Mira';
    const proposal = createCharacterEditProposal({ baseCard, proposedCard });
    const firstResult = applyCharacterEditProposal(proposal, baseCard, ['name']);

    const repeatedResult = applyCharacterEditProposal(proposal, firstResult.card, ['name']);

    expect(repeatedResult.conflictFieldKeys).toEqual([]);
    expect(repeatedResult.card.data.name).toBe('Mira');
    expect(repeatedResult.proposal.status).toBe(CHARACTER_EDIT_PROPOSAL_STATUSES.applied);
  });

  it('upserts streamed patches by field key', () => {
    const baseCard = createEmptyCharacterCard();
    const firstCard = structuredClone(baseCard);
    firstCard.data.name = 'First';
    const proposal = createCharacterEditProposal({ baseCard, proposedCard: firstCard });
    const secondCard = structuredClone(baseCard);
    secondCard.data.name = 'Second';
    const [replacementPatch] = createCharacterEditPatches(baseCard, secondCard);

    const nextProposal = reduceCharacterEditProposal(proposal, {
      type: 'patches-upserted',
      patches: replacementPatch ? [replacementPatch] : [],
      occurredAt: '2026-07-10T00:00:00.000Z',
    });

    expect(nextProposal.patches).toHaveLength(1);
    expect(nextProposal.patches[0]?.newValue).toBe('Second');
    expect(nextProposal.status).toBe(CHARACTER_EDIT_PROPOSAL_STATUSES.streaming);
  });

  it('does not let a stale streamed proposal replace its persisted applied state', () => {
    const baseCard = createEmptyCharacterCard();
    const proposedCard = structuredClone(baseCard);
    proposedCard.data.name = 'Mira';
    const streamedProposal = {
      ...createCharacterEditProposal({
        baseCard,
        proposedCard,
        sourceMessageId: 'message-1',
      }),
      updatedAt: '2026-07-19T12:00:00.000Z',
    };
    const appliedProposal = reduceCharacterEditProposal(streamedProposal, {
      type: 'apply-succeeded',
      fieldKeys: ['name'],
      occurredAt: '2026-07-19T12:00:01.000Z',
    });

    const proposals = upsertCharacterEditProposal([appliedProposal], streamedProposal);

    expect(proposals).toHaveLength(1);
    expect(proposals[0]?.status).toBe(CHARACTER_EDIT_PROPOSAL_STATUSES.applied);
    expect(proposals[0]?.patches[0]?.status).toBe(CHARACTER_EDIT_PATCH_STATUSES.applied);
  });

  it('supersedes unresolved changes to the same field with the latest proposal', () => {
    const baseCard = createEmptyCharacterCard();
    const firstCard = structuredClone(baseCard);
    firstCard.data.name = 'First name';
    firstCard.data.description = 'Keep this description';
    const firstProposal = createCharacterEditProposal({ baseCard, proposedCard: firstCard });
    const latestCard = structuredClone(baseCard);
    latestCard.data.name = 'Latest name';
    const latestProposal = createCharacterEditProposal({ baseCard, proposedCard: latestCard });

    const [supersededProposal] = supersedeOverlappingCharacterEditProposals([firstProposal], latestProposal);

    expect(supersededProposal?.patches.find((patch) => patch.fieldKey === 'name')?.status).toBe(
      CHARACTER_EDIT_PATCH_STATUSES.rejected,
    );
    expect(supersededProposal?.patches.find((patch) => patch.fieldKey === 'description')?.status).toBe(
      CHARACTER_EDIT_PATCH_STATUSES.proposed,
    );
    expect(supersededProposal?.status).toBe(CHARACTER_EDIT_PROPOSAL_STATUSES.review);
  });
});
