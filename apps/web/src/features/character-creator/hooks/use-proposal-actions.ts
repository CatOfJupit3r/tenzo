import { useMemo } from 'react';

import { toastSuccess } from '@~/components/toastifications/create-jsx-toasts';

import { updateCharacterAssistantSession } from '../collections/character-assistant-sessions.collection';
import type { CharacterCard } from '../lib/cards/card-schema';
import type { iCharacterEditProposal } from '../lib/proposals/character-edit-proposal';
import { createProposalActionsService } from './proposal-actions-service';

export function useProposalActions({
  sessionId,
  card,
  proposals,
  replaceCard,
}: {
  sessionId: string;
  card: CharacterCard;
  proposals: readonly iCharacterEditProposal[];
  replaceCard: (nextCard: CharacterCard) => Promise<unknown>;
}) {
  return useMemo(
    () =>
      createProposalActionsService({
        sessionId,
        card,
        proposals,
        replaceCard,
        sessionRepository: { update: updateCharacterAssistantSession },
        notifications: { success: toastSuccess },
      }),
    [card, proposals, replaceCard, sessionId],
  );
}
