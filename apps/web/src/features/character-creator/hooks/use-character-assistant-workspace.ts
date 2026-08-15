import { fetchServerSentEvents, useChat } from '@tanstack/ai-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

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
  createCharacterAssistantSessionRecord,
  ensureCharacterAssistantSession,
  removeCharacterAssistantSession,
  updateCharacterAssistantSession,
} from '../collections/character-assistant-sessions.collection';
import { ASSISTANT_FINAL_RESPONSE_SCHEMA } from '../lib/assistant/assistant-final-response';
import type {
  CharacterAssistantFocus,
  iCharacterAssistantContextAttachment,
  iChatTemplateRef,
} from '../lib/assistant/character-assistant-contracts';
import type { iCharacterAssistantSession } from '../lib/assistant/character-assistant-session';
import { createCharacterAssistantMessagePersistence } from '../lib/assistant/message-persistence';
import { readNewRecordedCharacterConcept } from '../lib/assistant/recorded-character-concept';
import type { CharacterCard } from '../lib/cards/card-schema';
import { buildChatInputContentParts } from '../lib/editor/chat-input-attachments';
import type { iChatInputAttachment } from '../lib/editor/chat-input-attachments';
import type { iCharacterGenerationSettings } from '../lib/generation/generation-config';
import {
  CHARACTER_EDIT_PROPOSAL_SCHEMA,
  isCharacterEditPatchUnresolved,
  supersedeOverlappingCharacterEditProposals,
} from '../lib/proposals/character-edit-proposal';
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
  updateGeneralCharacterIdea: (value: string) => unknown;
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

function sortAssistantSessions(sessions: readonly iCharacterAssistantSession[]) {
  return [...sessions].sort((first, second) => second.updatedAt.localeCompare(first.updatedAt));
}

export function useCharacterAssistantWorkspace({
  characterId,
  card,
  replaceCard,
  apiKey,
  generationSettings,
  generalCharacterIdea,
  updateGeneralCharacterIdea,
  shouldSendDisabledSamplers,
  providerKind,
  focus,
  contextAttachments,
}: iUseCharacterAssistantWorkspaceOptions) {
  const sessions = usePersistentCollection(characterAssistantSessionsCollection);
  const drafts = usePersistentCollection(characterAssistantComposerDraftsCollection);
  const characterSessions = useMemo(
    () => sortAssistantSessions(sessions.filter((candidate) => candidate.characterId === characterId)),
    [characterId, sessions],
  );
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const session =
    characterSessions.find((candidate) => candidate.id === selectedSessionId) ?? characterSessions[0] ?? null;
  const sessionId = session?.id ?? characterId;
  const storedComposerDraft = drafts.find((draft) => draft.characterId === characterId) ?? null;
  const persistence = useMemo(
    () => createCharacterAssistantMessagePersistence(sessionId, characterId),
    [characterId, sessionId],
  );
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
    threadId: sessionId,
    connection: fetchServerSentEvents('/api/character-assistant'),
    forwardedProps,
    persistence,
    outputSchema: ASSISTANT_FINAL_RESPONSE_SCHEMA,
    devtools: { name: 'Character Assistant' },
  });

  useEffect(() => {
    if (!characterId || session) return;
    void ensureCharacterAssistantSession(sessionId, characterId).then((createdSession) => {
      setSelectedSessionId(createdSession.id);
    });
  }, [characterId, session, sessionId]);
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
    const missingProposals = proposals.filter(
      (proposal) => !session.proposals.some((storedProposal) => storedProposal.id === proposal.id),
    );
    const newConcept = readNewRecordedCharacterConcept(chat.messages, session.lastRecordedConceptToolCallId);
    if (missingProposals.length === 0 && !newConcept) {
      return;
    }
    if (newConcept) updateGeneralCharacterIdea(newConcept.concept.premise);
    void updateCharacterAssistantSession(session.id, (draft) => {
      missingProposals.forEach((proposal) => {
        draft.proposals = supersedeOverlappingCharacterEditProposals(draft.proposals, proposal);
        draft.proposals.push(proposal);
      });
      if (newConcept) {
        draft.lastRecordedConceptToolCallId = newConcept.toolCallId;
      }
    });
  }, [chat.messages, session, updateGeneralCharacterIdea]);

  const proposalActions = useProposalActions({
    characterId,
    card,
    proposals: session?.proposals ?? [],
    replaceCard,
  });
  const activePatches = useMemo(
    () =>
      proposalActions.activeProposals.flatMap((proposal) =>
        proposal.patches
          .filter(isCharacterEditPatchUnresolved)
          .map((patch) => ({ proposalId: proposal.id, proposalSummary: proposal.summary, patch })),
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
    async (input: string, options: { templates?: iChatTemplateRef[]; attachments?: iChatInputAttachment[] } = {}) => {
      forwardedProps.templates = options.templates ?? [];
      try {
        const attachments = options.attachments ?? [];
        await chat.sendMessage(
          attachments.length > 0 ? { content: buildChatInputContentParts(input, attachments) } : input,
        );
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
  const createConversation = useCallback(async () => {
    if (chat.isLoading) chat.stop();
    const createdSession = await createCharacterAssistantSessionRecord(characterId);
    await clearCharacterAssistantComposerDraft(characterId);
    setSelectedSessionId(createdSession.id);
  }, [characterId, chat]);
  const selectConversation = useCallback(
    (nextSessionId: string) => {
      if (chat.isLoading || !characterSessions.some((candidate) => candidate.id === nextSessionId)) return;
      setSelectedSessionId(nextSessionId);
    },
    [characterSessions, chat.isLoading],
  );
  const deleteConversation = useCallback(
    async (sessionIdToDelete: string) => {
      if (chat.isLoading) return;
      const remainingSessions = characterSessions.filter((candidate) => candidate.id !== sessionIdToDelete);
      if (remainingSessions.length === 0) {
        const replacementSession = await createCharacterAssistantSessionRecord(characterId);
        setSelectedSessionId(replacementSession.id);
      } else if (sessionIdToDelete === sessionId) {
        setSelectedSessionId(remainingSessions[0]?.id ?? null);
      }
      await removeCharacterAssistantSession(sessionIdToDelete);
    },
    [characterId, characterSessions, chat.isLoading, sessionId],
  );
  return {
    sessionId,
    sessions: characterSessions,
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
    createConversation,
    selectConversation,
    deleteConversation,
  };
}
