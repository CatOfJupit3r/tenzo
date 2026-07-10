import { describe, expect, it } from 'vitest';

import { createEmptyCharacterCard } from '../constants/card-defaults';
import {
  applyCharacterEditProposal,
  CHARACTER_EDIT_PATCH_STATUSES,
  CHARACTER_EDIT_PROPOSAL_STATUSES,
  createCharacterCardRevision,
  createCharacterEditProposal,
  createCharacterEditPatches,
  reduceCharacterEditProposal,
} from './character-edit-proposal';

describe('character edit proposals', () => {
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
});
