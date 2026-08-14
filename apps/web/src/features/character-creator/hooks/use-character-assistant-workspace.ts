import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { toastError, toastInfo, toastSuccess } from '@~/components/toastifications/create-jsx-toasts';
import { usePersistentCollection } from '@~/db/persistent-collection';
import { generateUuid } from '@~/utils/uuid';

import {
  characterAssistantComposerDraftsCollection,
  clearCharacterAssistantComposerDraft,
  createCharacterAssistantComposerDraft,
  ensureCharacterAssistantComposerDraft,
  saveCharacterAssistantComposerDraft,
} from '../collections/character-assistant-composer-drafts.collection';
import type { iCharacterAssistantComposerDraft } from '../collections/character-assistant-composer-drafts.collection';
import {
  recordGuidedConcept,
  characterAssistantSessionsCollection,
  ensureCharacterAssistantSession,
  recordGuidedStepRunCompletion,
  updateCharacterAssistantSession,
} from '../collections/character-assistant-sessions.collection';
import type { GuidedStepId } from '../constants/guided-step-id';
import type { CharacterCard } from '../lib/card-schema';
import {
  CHARACTER_ASSISTANT_MESSAGE_ROLES,
  CHARACTER_ASSISTANT_STREAM_EVENT_TYPES,
} from '../lib/character-assistant-contracts';
import type {
  CharacterAssistantFocus,
  iCharacterAssistantContextAttachment,
  iChatTemplateRef,
  iCharacterAssistantMessage,
} from '../lib/character-assistant-contracts';
import {
  buildBoundedDiscoveryContext,
  buildDeterministicDiscoveryHandoffSummary,
  hasDiscoveryHandoffSelections,
} from '../lib/character-assistant-discovery-state';
import { consumeCharacterAssistantStream } from '../lib/character-assistant-stream';
import {
  applyCharacterEditProposal,
  CHARACTER_EDIT_PATCH_STATUSES,
  CHARACTER_EDIT_PROPOSAL_STATUSES,
  reduceCharacterEditProposal,
  upsertCharacterEditProposal,
} from '../lib/character-edit-proposal';
import type {
  CharacterEditFieldKey,
  CharacterEditPatchStatus,
  CharacterEditProposalStatus,
  iCharacterEditPatch,
  iCharacterEditProposal,
} from '../lib/character-edit-proposal';
import type { iCharacterGenerationSettings } from '../lib/generation-config';
import type { ProviderKind } from '../lib/provider-health';

interface iUseCharacterAssistantWorkspaceOptions {
  characterId: string;
  card: CharacterCard;
  replaceCard: (nextCard: CharacterCard) => Promise<void>;
  apiKey: string;
  generationSettings: iCharacterGenerationSettings;
  generalCharacterIdea: string;
  shouldSendDisabledSamplers: boolean;
  providerKind: ProviderKind | null;
  focus: CharacterAssistantFocus;
  contextAttachments: iCharacterAssistantContextAttachment[];
}

interface iCharacterAssistantRuntimeState {
  isRunning: boolean;
  errorMessage: string | null;
  streamingMessage: string;
  activityLabel: string | null;
  proposals: iCharacterEditProposal[];
  guidedStepId: GuidedStepId | null;
  hasCompletedCurrentGuidedStepRun: boolean;
}

export interface iCharacterAssistantPatchView {
  proposalId: string;
  proposalSummary: string | undefined;
  patch: iCharacterEditPatch;
}

const INITIAL_RUNTIME_STATE: iCharacterAssistantRuntimeState = {
  isRunning: false,
  errorMessage: null,
  streamingMessage: '',
  activityLabel: null,
  proposals: [],
  guidedStepId: null,
  hasCompletedCurrentGuidedStepRun: false,
};

const ACTIVE_PROPOSAL_STATUSES = new Set<CharacterEditProposalStatus>([
  CHARACTER_EDIT_PROPOSAL_STATUSES.streaming,
  CHARACTER_EDIT_PROPOSAL_STATUSES.review,
  CHARACTER_EDIT_PROPOSAL_STATUSES.applying,
  CHARACTER_EDIT_PROPOSAL_STATUSES.conflict,
  CHARACTER_EDIT_PROPOSAL_STATUSES.failed,
]);

const ACTIVE_PATCH_STATUSES = new Set<CharacterEditPatchStatus>([
  CHARACTER_EDIT_PATCH_STATUSES.proposed,
  CHARACTER_EDIT_PATCH_STATUSES.applying,
  CHARACTER_EDIT_PATCH_STATUSES.conflict,
]);

function createMessage(
  role: iCharacterAssistantMessage['role'],
  content: string,
  guidedStepId?: GuidedStepId,
): iCharacterAssistantMessage {
  return {
    id: generateUuid(),
    role,
    content,
    createdAt: new Date().toISOString(),
    guidedStepId,
  };
}

function assignGuidedStep(proposal: iCharacterEditProposal, guidedStepId?: GuidedStepId) {
  return guidedStepId ? { ...proposal, guidedStepId } : proposal;
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}

function formatToolActivity(toolName: string) {
  return toolName.replaceAll('_', ' ');
}

export function useCharacterAssistantWorkspace({
  characterId,
  card,
  replaceCard,
  apiKey,
  generationSettings,
  generalCharacterIdea,
  shouldSendDisabledSamplers,
  providerKind,
  focus,
  contextAttachments,
}: iUseCharacterAssistantWorkspaceOptions) {
  const [runtimeState, setRuntimeState] = useState<iCharacterAssistantRuntimeState>(INITIAL_RUNTIME_STATE);
  const abortControllerRef = useRef<AbortController | null>(null);
  const storedSessions = usePersistentCollection(characterAssistantSessionsCollection);
  const storedComposerDrafts = usePersistentCollection(characterAssistantComposerDraftsCollection);
  const session = useMemo(
    () => storedSessions.find((storedSession) => storedSession.id === characterId) ?? null,
    [characterId, storedSessions],
  );
  const storedComposerDraft = useMemo(
    () => storedComposerDrafts.find((draft) => draft.characterId === characterId) ?? null,
    [characterId, storedComposerDrafts],
  );
  const previousGuidedStepRef = useRef<string | null>(null);

  useEffect(() => {
    const currentGuidedStep = session?.mode === 'guided' ? (session.guided?.currentStep ?? null) : null;
    if (previousGuidedStepRef.current !== currentGuidedStep) {
      previousGuidedStepRef.current = currentGuidedStep;
      setRuntimeState((currentState) => ({ ...currentState, hasCompletedCurrentGuidedStepRun: false }));
    }
  }, [session?.guided?.currentStep, session?.mode]);

  useEffect(() => {
    if (!characterId || session) {
      return;
    }

    void ensureCharacterAssistantSession(characterId).catch((error: unknown) => {
      setRuntimeState((currentState) => ({
        ...currentState,
        errorMessage: error instanceof Error ? error.message : 'Character assistant session could not be created.',
      }));
    });
  }, [characterId, session]);

  useEffect(() => {
    if (!characterId || storedComposerDraft) {
      return;
    }

    void ensureCharacterAssistantComposerDraft(characterId).catch((error: unknown) => {
      setRuntimeState((currentState) => ({
        ...currentState,
        errorMessage: error instanceof Error ? error.message : 'Assistant draft could not be created.',
      }));
    });
  }, [characterId, storedComposerDraft]);

  const isConnectionConfigured = Boolean(
    generationSettings.endpoint.trim() && generationSettings.model.trim() && apiKey.trim(),
  );
  const proposals = useMemo(() => {
    let mergedProposals = session?.proposals ?? [];
    runtimeState.proposals.forEach((proposal) => {
      mergedProposals = upsertCharacterEditProposal(mergedProposals, proposal);
    });
    return mergedProposals;
  }, [runtimeState.proposals, session?.proposals]);
  const activeProposals = useMemo(
    () => proposals.filter((proposal) => ACTIVE_PROPOSAL_STATUSES.has(proposal.status)),
    [proposals],
  );
  const activePatches = useMemo(
    () =>
      activeProposals.flatMap((proposal) =>
        proposal.patches
          .filter((patch) => ACTIVE_PATCH_STATUSES.has(patch.status))
          .map((patch) => ({
            proposalId: proposal.id,
            proposalSummary: proposal.summary,
            patch,
          })),
      ),
    [activeProposals],
  );
  const messages = useMemo(() => {
    const storedMessages = session?.messages ?? [];

    if (!runtimeState.streamingMessage) {
      return storedMessages;
    }

    return [
      ...storedMessages,
      createMessage(
        CHARACTER_ASSISTANT_MESSAGE_ROLES.assistant,
        runtimeState.streamingMessage,
        runtimeState.guidedStepId ?? undefined,
      ),
    ];
  }, [runtimeState.guidedStepId, runtimeState.streamingMessage, session?.messages]);
  const composerDraft = storedComposerDraft ?? createCharacterAssistantComposerDraft(characterId);

  const updateComposerDraft = useCallback(
    async (nextDraft: Omit<iCharacterAssistantComposerDraft, 'characterId'>) => {
      await saveCharacterAssistantComposerDraft({ characterId, ...nextDraft });
    },
    [characterId],
  );

  const persistProposal = useCallback(
    async (nextProposal: iCharacterEditProposal) => {
      await updateCharacterAssistantSession(characterId, (draft) => {
        draft.proposals = upsertCharacterEditProposal(draft.proposals, nextProposal);
      });
    },
    [characterId],
  );

  const runAssistant = useCallback(
    async (input: string | null, options: { templates?: iChatTemplateRef[] } = {}) => {
      const trimmedInput = input?.trim() ?? '';

      if ((input !== null && !trimmedInput) || runtimeState.isRunning) {
        return false;
      }

      if (!isConnectionConfigured) {
        throw new Error('Set an endpoint, model, and API key before using the Character Assistant.');
      }

      const currentSession = await ensureCharacterAssistantSession(characterId);
      if (input === null && currentSession.messages.length === 0) {
        return false;
      }

      const isGuidedRun = currentSession.mode === 'guided' && currentSession.guided !== null;
      const guidedStep = isGuidedRun ? currentSession.guided?.currentStep : undefined;
      const guidedConcept = isGuidedRun ? (currentSession.guided?.concept ?? undefined) : undefined;
      const guidedDiscovery = isGuidedRun ? currentSession.guided?.discovery : undefined;
      const hasDiscoveryContext = Boolean(
        guidedDiscovery &&
        (guidedDiscovery.originalPremise.trim() ||
          hasDiscoveryHandoffSelections(buildDeterministicDiscoveryHandoffSummary(guidedDiscovery))),
      );
      const discoveryContext =
        guidedDiscovery && hasDiscoveryContext ? buildBoundedDiscoveryContext(guidedDiscovery) : undefined;
      const combinedAttachments = [
        ...contextAttachments,
        ...(isGuidedRun ? (currentSession.guided?.attachments ?? []) : []),
      ].filter(
        (attachment, index, attachments) =>
          attachments.findIndex((candidate) => candidate.id === attachment.id) === index,
      );
      const userMessage = trimmedInput
        ? createMessage(CHARACTER_ASSISTANT_MESSAGE_ROLES.user, trimmedInput, guidedStep)
        : null;
      const lastStoredMessage = currentSession.messages.at(-1);
      const continuationMessage =
        !userMessage && lastStoredMessage?.role === CHARACTER_ASSISTANT_MESSAGE_ROLES.assistant
          ? createMessage(
              CHARACTER_ASSISTANT_MESSAGE_ROLES.user,
              'Continue the conversation and provide the next useful response.',
              guidedStep,
            )
          : null;
      const conversationMessages = [
        ...currentSession.messages,
        ...(userMessage ? [userMessage] : []),
        ...(continuationMessage ? [continuationMessage] : []),
      ];
      if (userMessage) {
        await updateCharacterAssistantSession(currentSession.id, (draft) => {
          draft.messages.push(userMessage);
        });
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      setRuntimeState({
        isRunning: true,
        errorMessage: null,
        streamingMessage: '',
        activityLabel: 'Reviewing character',
        proposals: [],
        guidedStepId: guidedStep ?? null,
        hasCompletedCurrentGuidedStepRun: false,
      });

      try {
        const response = await fetch('/api/character-assistant', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: abortController.signal,
          body: JSON.stringify({
            characterId,
            provider: generationSettings.provider,
            endpoint: generationSettings.endpoint,
            apiKey,
            model: generationSettings.model,
            maxTokens: generationSettings.maxTokens,
            temperature: generationSettings.temperature,
            topP: generationSettings.topP,
            frequencyPenalty: generationSettings.frequencyPenalty,
            presencePenalty: generationSettings.presencePenalty,
            topK: generationSettings.topK,
            minP: generationSettings.minP,
            shouldSendDisabledSamplers,
            assistantGenerationMode: generationSettings.assistantGenerationMode,
            providerKind: providerKind ?? undefined,
            card,
            focus,
            messages: conversationMessages,
            generalCharacterIdea,
            contextAttachments: combinedAttachments,
            guidedStep,
            concept: guidedConcept,
            discoveryContext,
            templates: options.templates ?? [],
          }),
        });

        let completedMessage = '';
        let completedProposals: iCharacterEditProposal[] = [];
        let hasCompletedGuidedStep = false;
        let didEncounterRunError = false;
        await consumeCharacterAssistantStream(response, async (streamEvent) => {
          if (streamEvent.type === CHARACTER_ASSISTANT_STREAM_EVENT_TYPES['text-delta']) {
            setRuntimeState((currentState) => ({
              ...currentState,
              streamingMessage: `${currentState.streamingMessage}${streamEvent.textDelta}`,
              activityLabel: null,
            }));
            return;
          }

          if (streamEvent.type === CHARACTER_ASSISTANT_STREAM_EVENT_TYPES['tool-call-start']) {
            setRuntimeState((currentState) => ({
              ...currentState,
              activityLabel: `Preparing ${formatToolActivity(streamEvent.toolName)}`,
            }));
            return;
          }

          if (streamEvent.type === CHARACTER_ASSISTANT_STREAM_EVENT_TYPES.proposal) {
            const guidedProposal = assignGuidedStep(streamEvent.proposal, guidedStep);
            setRuntimeState((currentState) => ({
              ...currentState,
              proposals: upsertCharacterEditProposal(currentState.proposals, guidedProposal),
              activityLabel: `Proposed ${streamEvent.proposal.patches.length} change${streamEvent.proposal.patches.length === 1 ? '' : 's'}`,
            }));
            return;
          }

          if (streamEvent.type === CHARACTER_ASSISTANT_STREAM_EVENT_TYPES['tool-call-error']) {
            didEncounterRunError = true;
            setRuntimeState((currentState) => ({
              ...currentState,
              activityLabel: null,
              errorMessage: streamEvent.message,
            }));
            return;
          }

          if (streamEvent.type === CHARACTER_ASSISTANT_STREAM_EVENT_TYPES['concept-recorded']) {
            await recordGuidedConcept(characterId, streamEvent.concept);
            setRuntimeState((currentState) => ({
              ...currentState,
              activityLabel: 'Concept recorded',
            }));
            return;
          }

          if (streamEvent.type === CHARACTER_ASSISTANT_STREAM_EVENT_TYPES.complete) {
            completedMessage = streamEvent.assistantMessage;
            completedProposals = streamEvent.proposals.map((proposal) => assignGuidedStep(proposal, guidedStep));
            hasCompletedGuidedStep = streamEvent.hasCompletedGuidedStep;
            if (isGuidedRun && streamEvent.concept) {
              await recordGuidedConcept(characterId, streamEvent.concept);
            }
            return;
          }

          if (streamEvent.type === CHARACTER_ASSISTANT_STREAM_EVENT_TYPES.error) {
            didEncounterRunError = true;
            throw new Error(streamEvent.message);
          }
        });

        const assistantMessage = createMessage(
          CHARACTER_ASSISTANT_MESSAGE_ROLES.assistant,
          completedMessage || 'The proposed changes are ready for review.',
          guidedStep,
        );
        await updateCharacterAssistantSession(currentSession.id, (draft) => {
          draft.messages.push(assistantMessage);
          completedProposals.forEach((proposal) => {
            draft.proposals = upsertCharacterEditProposal(draft.proposals, proposal);
          });
        });
        if (isGuidedRun && guidedStep && !didEncounterRunError && hasCompletedGuidedStep) {
          await recordGuidedStepRunCompletion(characterId, guidedStep);
        }
        setRuntimeState({
          ...INITIAL_RUNTIME_STATE,
          hasCompletedCurrentGuidedStepRun: isGuidedRun && !didEncounterRunError && hasCompletedGuidedStep,
        });
        return !didEncounterRunError;
      } catch (error) {
        if (isAbortError(error)) {
          setRuntimeState(INITIAL_RUNTIME_STATE);
          toastInfo('Assistant stopped', 'The current assistant run was cancelled.');
          return false;
        }

        const errorMessage = error instanceof Error ? error.message : 'Character assistant failed.';
        setRuntimeState((currentState) => ({
          ...currentState,
          isRunning: false,
          activityLabel: null,
          errorMessage,
        }));
        toastError('Character Assistant failed', errorMessage);
        return false;
      } finally {
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null;
        }
      }
    },
    [
      apiKey,
      card,
      characterId,
      contextAttachments,
      focus,
      generalCharacterIdea,
      generationSettings,
      isConnectionConfigured,
      runtimeState.isRunning,
      providerKind,
      shouldSendDisabledSamplers,
    ],
  );

  const sendMessage = useCallback(
    async (input: string, options: { templates?: iChatTemplateRef[] } = {}) => runAssistant(input, options),
    [runAssistant],
  );

  const requestResponse = useCallback(
    async (options: { templates?: iChatTemplateRef[] } = {}) => runAssistant(null, options),
    [runAssistant],
  );

  const applyProposalFields = useCallback(
    async (proposalId: string, fieldKeys?: CharacterEditFieldKey[], resolvedTextValue?: string) => {
      const proposal = proposals.find((candidate) => candidate.id === proposalId);

      if (!proposal) {
        throw new Error('The selected proposal is unavailable.');
      }

      const selectedFieldKeys =
        fieldKeys ??
        proposal.patches
          .filter((patch) => patch.status === CHARACTER_EDIT_PATCH_STATUSES.proposed)
          .map((patch) => patch.fieldKey);
      let proposalToApply = proposal;

      if (resolvedTextValue !== undefined && selectedFieldKeys.length === 1) {
        proposalToApply = {
          ...proposal,
          patches: proposal.patches.map((patch) =>
            patch.fieldKey === selectedFieldKeys[0] && patch.kind === 'text'
              ? { ...patch, newValue: resolvedTextValue }
              : patch,
          ),
        };
      }

      const applyingProposal = reduceCharacterEditProposal(proposalToApply, {
        type: 'apply-requested',
        fieldKeys: selectedFieldKeys,
        occurredAt: new Date().toISOString(),
      });
      await persistProposal(applyingProposal);
      const applyResult = applyCharacterEditProposal(proposalToApply, card, selectedFieldKeys);

      if (applyResult.conflictFieldKeys.length > 0) {
        await persistProposal(applyResult.proposal);
        throw new Error(`Review conflicts in ${applyResult.conflictFieldKeys.join(', ')} before applying.`);
      }

      await replaceCard(applyResult.card);
      await persistProposal(applyResult.proposal);
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

      if (!proposal) {
        throw new Error('The selected proposal is unavailable.');
      }

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
    const applyResults: ReturnType<typeof applyCharacterEditProposal>[] = [];
    let appliedFieldCount = 0;

    for (const proposal of activeProposals) {
      const fieldKeys = proposal.patches
        .filter((patch) => patch.status === CHARACTER_EDIT_PATCH_STATUSES.proposed)
        .map((patch) => patch.fieldKey);

      if (fieldKeys.length === 0) {
        continue;
      }

      const applyResult = applyCharacterEditProposal(proposal, projectedCard, fieldKeys);
      if (applyResult.conflictFieldKeys.length > 0) {
        await persistProposal(applyResult.proposal);
        throw new Error(`Review conflicts in ${applyResult.conflictFieldKeys.join(', ')} before applying.`);
      }

      projectedCard = applyResult.card;
      applyResults.push(applyResult);
      appliedFieldCount += fieldKeys.length;
    }

    if (applyResults.length === 0) {
      return;
    }

    for (const applyResult of applyResults) {
      await persistProposal(
        reduceCharacterEditProposal(
          activeProposals.find((proposal) => proposal.id === applyResult.proposal.id) ?? applyResult.proposal,
          {
            type: 'apply-requested',
            fieldKeys: applyResult.proposal.patches
              .filter((patch) => patch.status === CHARACTER_EDIT_PATCH_STATUSES.applied)
              .map((patch) => patch.fieldKey),
            occurredAt: new Date().toISOString(),
          },
        ),
      );
    }

    await replaceCard(projectedCard);
    for (const applyResult of applyResults) {
      await persistProposal(applyResult.proposal);
    }

    toastSuccess(
      'Changes applied',
      `Applied ${appliedFieldCount} character change${appliedFieldCount === 1 ? '' : 's'}.`,
    );
  }, [activeProposals, card, persistProposal, replaceCard]);

  const discardAllProposals = useCallback(async () => {
    for (const proposal of activeProposals) {
      const fieldKeys = proposal.patches
        .filter((patch) => patch.status !== CHARACTER_EDIT_PATCH_STATUSES.applied)
        .map((patch) => patch.fieldKey);

      if (fieldKeys.length > 0) {
        await rejectProposalFields(proposal.id, fieldKeys);
      }
    }
  }, [activeProposals, rejectProposalFields]);

  const clearConversation = useCallback(async () => {
    const currentSession = await ensureCharacterAssistantSession(characterId);
    await updateCharacterAssistantSession(currentSession.id, (draft) => {
      draft.messages = [];
    });
    setRuntimeState(INITIAL_RUNTIME_STATE);
    await clearCharacterAssistantComposerDraft(characterId);
  }, [characterId]);

  return {
    composerDraft,
    composerDraftSessionId: storedComposerDraft?.characterId ?? null,
    messages,
    activeProposals,
    activePatches,
    hasUnresolvedProposals: activeProposals.length > 0,
    isConnectionConfigured,
    isRunning: runtimeState.isRunning,
    errorMessage: runtimeState.errorMessage,
    activityLabel: runtimeState.activityLabel,
    hasCompletedCurrentGuidedStepRun: runtimeState.hasCompletedCurrentGuidedStepRun,
    sendMessage,
    requestResponse,
    updateComposerDraft,
    cancelRun: () => abortControllerRef.current?.abort(),
    applyProposalFields,
    applyAllProposals,
    rejectProposalFields,
    discardAllProposals,
    clearConversation,
  };
}
