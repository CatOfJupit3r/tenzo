import { fetchServerSentEvents, useChat } from '@tanstack/ai-react';
import { useCallback, useEffect, useMemo } from 'react';

import { toastError, toastInfo } from '@~/components/toastifications/create-jsx-toasts';
import { usePersistentCollection } from '@~/db/persistent-collection';

import {
  characterAssistantComposerDraftsCollection,
  clearCharacterAssistantComposerDraft,
  createCharacterAssistantComposerDraft,
  ensureCharacterAssistantComposerDraft,
  saveCharacterAssistantComposerDraft,
} from '../collections/character-assistant-composer-drafts.collection';
import type { iCharacterAssistantComposerDraft } from '../collections/character-assistant-composer-drafts.collection';
import {
  characterAssistantSessionsCollection,
  ensureCharacterAssistantSession,
  updateCharacterAssistantSession,
} from '../collections/character-assistant-sessions.collection';
import { ASSISTANT_FINAL_RESPONSE_SCHEMA } from '../lib/assistant/assistant-final-response';
import { CHARACTER_CONCEPT_SCHEMA } from '../lib/assistant/character-assistant-contracts';
import type {
  CharacterAssistantFocus,
  iCharacterAssistantContextAttachment,
  iChatTemplateRef,
} from '../lib/assistant/character-assistant-contracts';
import { createCharacterAssistantMessagePersistence } from '../lib/assistant/message-persistence';
import type { CharacterCard } from '../lib/cards/card-schema';
import type { iCharacterGenerationSettings } from '../lib/generation/generation-config';
import { CHARACTER_EDIT_PROPOSAL_SCHEMA } from '../lib/proposals/character-edit-proposal';
import type { iCharacterEditPatch } from '../lib/proposals/character-edit-proposal';
import type { ProviderKind } from '../lib/provider/provider-health';
import { useProposalActions } from './use-proposal-actions';

interface iUseCharacterAssistantWorkspaceOptions {
  characterId: string;
  card: CharacterCard;
  replaceCard: (nextCard: CharacterCard) => Promise<unknown>;
  apiKey: string;
  generationSettings: iCharacterGenerationSettings;
  generalCharacterIdea: string;
  shouldSendDisabledSamplers: boolean;
  providerKind: ProviderKind | null;
  focus: CharacterAssistantFocus;
  contextAttachments: iCharacterAssistantContextAttachment[];
}

export interface iCharacterAssistantPatchView {
  proposalId: string;
  proposalSummary: string | undefined;
  patch: iCharacterEditPatch;
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
  const sessions = usePersistentCollection(characterAssistantSessionsCollection);
  const drafts = usePersistentCollection(characterAssistantComposerDraftsCollection);
  const session = sessions.find((candidate) => candidate.id === characterId) ?? null;
  const storedComposerDraft = drafts.find((draft) => draft.characterId === characterId) ?? null;
  const persistence = useMemo(() => createCharacterAssistantMessagePersistence(characterId), [characterId]);
  const forwardedProps = useMemo<Record<string, unknown>>(() => ({ characterId }), [characterId]);
  Object.assign(forwardedProps, {
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
    generalCharacterIdea,
    contextAttachments,
    templates: [],
  });
  const chat = useChat({
    threadId: characterId,
    connection: fetchServerSentEvents('/api/character-assistant'),
    forwardedProps,
    persistence,
    outputSchema: ASSISTANT_FINAL_RESPONSE_SCHEMA,
    devtools: { name: 'Character Assistant' },
  });

  useEffect(() => {
    if (!characterId || session) return;
    void ensureCharacterAssistantSession(characterId);
  }, [characterId, session]);
  useEffect(() => {
    if (!characterId || storedComposerDraft) return;
    void ensureCharacterAssistantComposerDraft(characterId);
  }, [characterId, storedComposerDraft]);

  useEffect(() => {
    if (!session) return;
    const proposals = chat.messages.flatMap((message) =>
      message.parts.flatMap((part) => {
        if (part.type !== 'tool-call' || !part.output || typeof part.output !== 'object') return [];
        const result = CHARACTER_EDIT_PROPOSAL_SCHEMA.safeParse((part.output as { proposal?: unknown }).proposal);
        return result.success ? [result.data] : [];
      }),
    );
    const concepts = chat.messages.flatMap((message) =>
      message.parts.flatMap((part) => {
        if (part.type !== 'tool-call' || !part.output || typeof part.output !== 'object') return [];
        const result = CHARACTER_CONCEPT_SCHEMA.safeParse((part.output as { concept?: unknown }).concept);
        return result.success ? [result.data] : [];
      }),
    );
    const missingProposals = proposals.filter(
      (proposal) => !session.proposals.some((storedProposal) => storedProposal.id === proposal.id),
    );
    const latestConcept = concepts.at(-1);
    if (
      missingProposals.length === 0 &&
      (!latestConcept || JSON.stringify(latestConcept) === JSON.stringify(session.concept))
    ) {
      return;
    }
    void updateCharacterAssistantSession(session.id, (draft) => {
      draft.proposals.push(...missingProposals);
      if (latestConcept) draft.concept = latestConcept;
    });
  }, [chat.messages, session]);

  const proposalActions = useProposalActions({
    characterId,
    card,
    proposals: session?.proposals ?? [],
    replaceCard,
  });
  const activePatches = useMemo(
    () =>
      proposalActions.activeProposals.flatMap((proposal) =>
        proposal.patches.map((patch) => ({ proposalId: proposal.id, proposalSummary: proposal.summary, patch })),
      ),
    [proposalActions.activeProposals],
  );
  const composerDraft = storedComposerDraft ?? createCharacterAssistantComposerDraft(characterId);
  const updateComposerDraft = useCallback(
    async (nextDraft: Omit<iCharacterAssistantComposerDraft, 'characterId'>) => {
      await saveCharacterAssistantComposerDraft({ characterId, ...nextDraft });
    },
    [characterId],
  );
  const sendMessage = useCallback(
    async (input: string, options: { templates?: iChatTemplateRef[] } = {}) => {
      forwardedProps.templates = options.templates ?? [];
      try {
        await chat.sendMessage(input);
        return true;
      } catch (error) {
        toastError(
          'Character Assistant failed',
          error instanceof Error ? error.message : 'Character assistant failed.',
        );
        return false;
      }
    },
    [chat, forwardedProps],
  );
  const clearConversation = useCallback(async () => {
    chat.clear();
    await clearCharacterAssistantComposerDraft(characterId);
  }, [characterId, chat]);

  return {
    composerDraft,
    composerDraftSessionId: storedComposerDraft?.characterId ?? null,
    messages: chat.messages,
    activePatches,
    hasUnresolvedProposals: proposalActions.activeProposals.length > 0,
    isConnectionConfigured: Boolean(
      generationSettings.endpoint.trim() && generationSettings.model.trim() && apiKey.trim(),
    ),
    isRunning: chat.isLoading,
    errorMessage: chat.error?.message ?? null,
    activityLabel: chat.isLoading ? 'Working on your character' : null,
    sendMessage,
    requestResponse: async () => {
      try {
        await chat.reload();
        return true;
      } catch (error) {
        toastError(
          'Character Assistant failed',
          error instanceof Error ? error.message : 'Character assistant failed.',
        );
        return false;
      }
    },
    updateComposerDraft,
    cancelRun: () => {
      chat.stop();
      toastInfo('Assistant stopped', 'The current assistant run was cancelled.');
    },
    ...proposalActions,
    clearConversation,
  };
}
