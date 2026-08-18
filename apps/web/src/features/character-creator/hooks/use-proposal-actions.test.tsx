import { describe, expect, it, vi } from 'vitest';

import { createEmptyCharacterCard } from '../constants/card-defaults';
import { createCharacterAssistantSession } from '../lib/assistant/character-assistant-session';
import { createCharacterEditProposal } from '../lib/proposals/character-edit-proposal';
import { createProposalActionsService } from './proposal-actions-service';

describe('proposal actions service', () => {
  it('does not expose proposals without unresolved patches as active', () => {
    const card = createEmptyCharacterCard();
    const emptyProposal = createCharacterEditProposal({ baseCard: card, proposedCard: structuredClone(card) });
    const service = createProposalActionsService({
      sessionId: 'session-2',
      card,
      proposals: [emptyProposal],
      replaceCard: async () => undefined,
      sessionRepository: { update: async () => undefined },
      notifications: { success: () => undefined },
    });

    expect(service.activeProposals).toEqual([]);
  });

  it('persists proposal changes to the active conversation', async () => {
    const card = createEmptyCharacterCard();
    const proposedCard = structuredClone(card);
    proposedCard.data.name = 'Mira';
    const proposal = createCharacterEditProposal({ baseCard: card, proposedCard });
    const patch = proposal.patches[0];
    if (!patch) throw new Error('Expected the proposal to contain a patch.');
    const session = createCharacterAssistantSession('character-1');
    const updateSession = vi.fn(async (_sessionId: string, recipe: (draft: typeof session) => unknown) => {
      recipe(session);
    });
    const service = createProposalActionsService({
      sessionId: 'session-2',
      card,
      proposals: [proposal],
      replaceCard: async () => undefined,
      sessionRepository: { update: updateSession },
      notifications: { success: () => undefined },
    });

    await service.rejectProposalFields(proposal.id, [patch.fieldKey]);

    expect(updateSession).toHaveBeenCalledWith('session-2', expect.any(Function));
    expect(session.proposals).toHaveLength(1);
  });

  it('applies every proposed patch in a bulk action', async () => {
    const card = createEmptyCharacterCard();
    const proposedCard = structuredClone(card);
    proposedCard.data.name = 'Mira';
    proposedCard.data.description = 'A careful archivist.';
    const proposal = createCharacterEditProposal({ baseCard: card, proposedCard });
    const replaceCard = vi.fn().mockResolvedValue(undefined);
    const session = createCharacterAssistantSession('character-1');
    const service = createProposalActionsService({
      sessionId: 'session-2',
      card,
      proposals: [proposal],
      replaceCard,
      sessionRepository: {
        update: async (_sessionId, recipe) => {
          recipe(session);
        },
      },
      notifications: { success: () => undefined },
    });

    await service.applyAllProposals();

    expect(replaceCard).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Mira', description: 'A careful archivist.' }),
      }),
    );
  });
});
