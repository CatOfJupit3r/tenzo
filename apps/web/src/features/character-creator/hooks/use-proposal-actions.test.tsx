import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createEmptyCharacterCard } from '../constants/card-defaults';
import { createCharacterEditProposal } from '../lib/proposals/character-edit-proposal';
import { useProposalActions } from './use-proposal-actions';

const { updateSessionMock } = vi.hoisted(() => ({
  updateSessionMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../collections/character-assistant-sessions.collection', () => ({
  updateCharacterAssistantSession: updateSessionMock,
}));

vi.mock('@~/components/toastifications/create-jsx-toasts', () => ({
  toastSuccess: vi.fn(),
}));

describe('useProposalActions', () => {
  it('does not expose proposals without unresolved patches as active', () => {
    const card = createEmptyCharacterCard();
    const emptyProposal = createCharacterEditProposal({ baseCard: card, proposedCard: structuredClone(card) });
    const { result } = renderHook(() =>
      useProposalActions({
        sessionId: 'session-2',
        card,
        proposals: [emptyProposal],
        replaceCard: vi.fn().mockResolvedValue(undefined),
      }),
    );

    expect(result.current.activeProposals).toEqual([]);
  });

  it('persists proposal changes to the active conversation', async () => {
    const card = createEmptyCharacterCard();
    const proposedCard = structuredClone(card);
    proposedCard.data.name = 'Mira';
    const proposal = createCharacterEditProposal({ baseCard: card, proposedCard });
    const patch = proposal.patches[0];
    if (!patch) throw new Error('Expected the proposal to contain a patch.');
    const { result } = renderHook(() =>
      useProposalActions({
        sessionId: 'session-2',
        card,
        proposals: [proposal],
        replaceCard: vi.fn().mockResolvedValue(undefined),
      }),
    );

    await act(async () => result.current.rejectProposalFields(proposal.id, [patch.fieldKey]));

    expect(updateSessionMock).toHaveBeenCalledWith('session-2', expect.any(Function));
  });

  it('applies every proposed patch in a bulk action', async () => {
    const card = createEmptyCharacterCard();
    const proposedCard = structuredClone(card);
    proposedCard.data.name = 'Mira';
    proposedCard.data.description = 'A careful archivist.';
    const proposal = createCharacterEditProposal({ baseCard: card, proposedCard });
    const replaceCard = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useProposalActions({ sessionId: 'session-2', card, proposals: [proposal], replaceCard }),
    );

    await act(async () => result.current.applyAllProposals());

    expect(replaceCard).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Mira', description: 'A careful archivist.' }),
      }),
    );
  });
});
