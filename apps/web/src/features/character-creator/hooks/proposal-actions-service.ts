import type { iCharacterAssistantSession } from '../lib/assistant/character-assistant-session';
import type { CharacterCard } from '../lib/cards/card-schema';
import {
  applyCharacterEditProposal,
  CHARACTER_EDIT_PATCH_STATUSES,
  CHARACTER_EDIT_PROPOSAL_STATUSES,
  isCharacterEditPatchUnresolved,
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

export interface iProposalSessionRepository {
  update: (sessionId: string, recipe: (draft: iCharacterAssistantSession) => unknown) => Promise<unknown>;
}

export interface iProposalNotificationPort {
  success: (title: string, message: string) => unknown;
}

export interface iProposalActionsService {
  activeProposals: iCharacterEditProposal[];
  applyProposalFields: (
    proposalId: string,
    fieldKeys?: CharacterEditFieldKey[],
    resolvedTextValue?: string,
  ) => Promise<void>;
  rejectProposalFields: (proposalId: string, fieldKeys: CharacterEditFieldKey[]) => Promise<void>;
  applyAllProposals: () => Promise<void>;
  discardAllProposals: () => Promise<void>;
}

export function createProposalActionsService({
  sessionId,
  card,
  proposals,
  replaceCard,
  sessionRepository,
  notifications,
}: {
  sessionId: string;
  card: CharacterCard;
  proposals: readonly iCharacterEditProposal[];
  replaceCard: (nextCard: CharacterCard) => Promise<unknown>;
  sessionRepository: iProposalSessionRepository;
  notifications: iProposalNotificationPort;
}): iProposalActionsService {
  const activeProposals = proposals.filter(
    (proposal) =>
      ACTIVE_PROPOSAL_STATUSES.has(proposal.status) && proposal.patches.some(isCharacterEditPatchUnresolved),
  );

  const persistProposal = async (proposal: iCharacterEditProposal) => {
    await sessionRepository.update(sessionId, (draft) => {
      draft.proposals = upsertCharacterEditProposal(draft.proposals, proposal);
    });
  };

  const applyProposalFields = async (
    proposalId: string,
    fieldKeys?: CharacterEditFieldKey[],
    resolvedTextValue?: string,
  ) => {
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
    notifications.success(
      'Changes applied',
      `Applied ${selectedFieldKeys.length} character change${selectedFieldKeys.length === 1 ? '' : 's'}.`,
    );
  };

  const rejectProposalFields = async (proposalId: string, fieldKeys: CharacterEditFieldKey[]) => {
    const proposal = proposals.find((candidate) => candidate.id === proposalId);
    if (!proposal) throw new Error('The selected proposal is unavailable.');
    await persistProposal(
      reduceCharacterEditProposal(proposal, {
        type: 'patches-rejected',
        fieldKeys,
        occurredAt: new Date().toISOString(),
      }),
    );
  };

  const applyAllProposals = async () => {
    let projectedCard = card;
    let appliedPatchCount = 0;
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
      appliedPatchCount += fieldKeys.length;
      results.push(result);
    }
    if (results.length === 0) throw new Error('There are no proposed changes to apply.');
    await replaceCard(projectedCard);
    await Promise.all(results.map(async (result) => persistProposal(result.proposal)));
    notifications.success(
      'Changes applied',
      `Applied ${appliedPatchCount} character change${appliedPatchCount === 1 ? '' : 's'}.`,
    );
  };

  const discardAllProposals = async () => {
    await Promise.all(
      activeProposals.map(async (proposal) => {
        const fieldKeys = proposal.patches
          .filter((patch) => patch.status !== CHARACTER_EDIT_PATCH_STATUSES.applied)
          .map((patch) => patch.fieldKey);
        if (fieldKeys.length > 0) await rejectProposalFields(proposal.id, fieldKeys);
      }),
    );
  };

  return { activeProposals, applyProposalFields, rejectProposalFields, applyAllProposals, discardAllProposals };
}
