import { useCallback, useMemo } from 'react';

import { toastSuccess } from '@~/components/toastifications/create-jsx-toasts';

import { updateCharacterAssistantSession } from '../collections/character-assistant-sessions.collection';
import type { CharacterCard } from '../lib/cards/card-schema';
import {
  applyCharacterEditProposal,
  CHARACTER_EDIT_PATCH_STATUSES,
  CHARACTER_EDIT_PROPOSAL_STATUSES,
  reduceCharacterEditProposal,
  upsertCharacterEditProposal,
} from '../lib/proposals/character-edit-proposal';
import type {
  CharacterEditFieldKey,
  CharacterEditProposalStatus,
  iCharacterEditProposal,
} from '../lib/proposals/character-edit-proposal';

const ACTIVE_PROPOSAL_STATUSES = new Set<CharacterEditProposalStatus>([
  CHARACTER_EDIT_PROPOSAL_STATUSES.streaming,
  CHARACTER_EDIT_PROPOSAL_STATUSES.review,
  CHARACTER_EDIT_PROPOSAL_STATUSES.applying,
  CHARACTER_EDIT_PROPOSAL_STATUSES.conflict,
  CHARACTER_EDIT_PROPOSAL_STATUSES.failed,
]);

export function useProposalActions({
  characterId,
  card,
  proposals,
  replaceCard,
}: {
  characterId: string;
  card: CharacterCard;
  proposals: readonly iCharacterEditProposal[];
  replaceCard: (nextCard: CharacterCard) => Promise<unknown>;
}) {
  const activeProposals = useMemo(
    () => proposals.filter((proposal) => ACTIVE_PROPOSAL_STATUSES.has(proposal.status)),
    [proposals],
  );
  const persistProposal = useCallback(
    async (proposal: iCharacterEditProposal) => {
      await updateCharacterAssistantSession(characterId, (draft) => {
        draft.proposals = upsertCharacterEditProposal(draft.proposals, proposal);
      });
    },
    [characterId],
  );
  const applyProposalFields = useCallback(
    async (proposalId: string, fieldKeys?: CharacterEditFieldKey[], resolvedTextValue?: string) => {
      const proposal = proposals.find((candidate) => candidate.id === proposalId);
      if (!proposal) throw new Error('The selected proposal is unavailable.');
      const selectedFieldKeys =
        fieldKeys ??
        proposal.patches
          .filter((patch) => patch.status === CHARACTER_EDIT_PATCH_STATUSES.proposed)
          .map((patch) => patch.fieldKey);
      const proposalToApply =
        resolvedTextValue !== undefined && selectedFieldKeys.length === 1
          ? {
              ...proposal,
              patches: proposal.patches.map((patch) =>
                patch.fieldKey === selectedFieldKeys[0] && patch.kind === 'text'
                  ? { ...patch, newValue: resolvedTextValue }
                  : patch,
              ),
            }
          : proposal;
      await persistProposal(
        reduceCharacterEditProposal(proposalToApply, {
          type: 'apply-requested',
          fieldKeys: selectedFieldKeys,
          occurredAt: new Date().toISOString(),
        }),
      );
      const result = applyCharacterEditProposal(proposalToApply, card, selectedFieldKeys);
      if (result.conflictFieldKeys.length > 0) {
        await persistProposal(result.proposal);
        throw new Error(`Review conflicts in ${result.conflictFieldKeys.join(', ')} before applying.`);
      }
      await replaceCard(result.card);
      await persistProposal(result.proposal);
      toastSuccess(
        'Changes applied',
        `Applied ${selectedFieldKeys.length} character change${selectedFieldKeys.length === 1 ? '' : 's'}.`,
      );
    },
    [card, persistProposal, proposals, replaceCard],
  );
  const rejectProposalFields = useCallback(
    async (proposalId: string, fieldKeys: CharacterEditFieldKey[]) => {
      const proposal = proposals.find((candidate) => candidate.id === proposalId);
      if (!proposal) throw new Error('The selected proposal is unavailable.');
      await persistProposal(
        reduceCharacterEditProposal(proposal, {
          type: 'patches-rejected',
          fieldKeys,
          occurredAt: new Date().toISOString(),
        }),
      );
    },
    [persistProposal, proposals],
  );
  const applyAllProposals = useCallback(async () => {
    let projectedCard = card;
    const results: ReturnType<typeof applyCharacterEditProposal>[] = [];
    for (const proposal of activeProposals) {
      const fieldKeys = proposal.patches
        .filter((patch) => patch.status === CHARACTER_EDIT_PATCH_STATUSES.proposed)
        .map((patch) => patch.fieldKey);
      if (fieldKeys.length === 0) continue;
      const result = applyCharacterEditProposal(proposal, projectedCard, fieldKeys);
      if (result.conflictFieldKeys.length > 0) {
        await persistProposal(result.proposal);
        throw new Error(`Review conflicts in ${result.conflictFieldKeys.join(', ')} before applying.`);
      }
      projectedCard = result.card;
      results.push(result);
    }
    if (results.length === 0) return;
    await replaceCard(projectedCard);
    await Promise.all(results.map(async (result) => persistProposal(result.proposal)));
  }, [activeProposals, card, persistProposal, replaceCard]);
  const discardAllProposals = useCallback(async () => {
    await Promise.all(
      activeProposals.map(async (proposal) => {
        const fieldKeys = proposal.patches
          .filter((patch) => patch.status !== CHARACTER_EDIT_PATCH_STATUSES.applied)
          .map((patch) => patch.fieldKey);
        if (fieldKeys.length > 0) await rejectProposalFields(proposal.id, fieldKeys);
      }),
    );
  }, [activeProposals, rejectProposalFields]);

  return { activeProposals, applyProposalFields, rejectProposalFields, applyAllProposals, discardAllProposals };
}
