import { fetchServerSentEvents, useChat } from '@tanstack/ai-react';
import { parseAsString, useQueryState } from 'nuqs';
import { useCallback, useEffect, useMemo } from 'react';

import { toastError, toastInfo } from '@~/components/toastifications/create-jsx-toasts';
import { usePersistentCollection } from '@~/db/persistent-collection';
import { loggerFactory } from '@~/lib/logging/logger';

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
import { MAX_CHAT_TEMPLATE_REF_COUNT } from '../lib/assistant/character-assistant-contracts';
import type {
  CharacterAssistantFocus,
  iCharacterAssistantContextAttachment,
  iChatTemplateRef,
} from '../lib/assistant/character-assistant-contracts';
import { CHARACTER_ASSISTANT_GENERATION_MODES } from '../lib/assistant/character-assistant-generation-mode';
import type { iCharacterAssistantSession } from '../lib/assistant/character-assistant-session';
import { readNewRecordedCharacterConcept } from '../lib/assistant/recorded-character-concept';
import type { CharacterCard } from '../lib/cards/card-schema';
import { buildChatInputContentParts, readChatAttachmentMetadata } from '../lib/editor/chat-input-attachments';
import type { iChatInputAttachment } from '../lib/editor/chat-input-attachments';
import type { iCharacterGenerationSettings } from '../lib/generation/generation-config';
import type { iPromptExampleCharacter } from '../lib/prompt/generation-contracts';
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
  exampleCharacters: iPromptExampleCharacter[];
  maxExampleContextCharacters: number;
  focusTemplates: iChatTemplateRef[];
}

const CHARACTER_ASSISTANT_WORKSPACE_LOGGER = loggerFactory.getLogger('character-assistant.workspace');

export interface iCharacterAssistantPatchView {
  proposalId: string;
  proposalSummary: string | undefined;
  patch: iCharacterEditPatch;
}

function sortAssistantSessions(sessions: readonly iCharacterAssistantSession[]) {
  return [...sessions].sort((first, second) => second.updatedAt.localeCompare(first.updatedAt));
}

function readProposalIds(messages: readonly iCharacterAssistantSession['messages'][number][]) {
  return new Set(
    messages.flatMap((message) =>
      message.parts.flatMap((part) => {
        if (part.type !== 'tool-call' || !part.output || typeof part.output !== 'object') return [];
        const result = CHARACTER_EDIT_PROPOSAL_SCHEMA.safeParse((part.output as { proposal?: unknown }).proposal);
        return result.success ? [result.data.id] : [];
      }),
    ),
  );
}

function hasToolCall(messages: readonly iCharacterAssistantSession['messages'][number][], toolCallId: string) {
  return messages.some((message) => message.parts.some((part) => part.type === 'tool-call' && part.id === toolCallId));
}

function areMessagesEqual(
  first: readonly iCharacterAssistantSession['messages'][number][],
  second: readonly iCharacterAssistantSession['messages'][number][],
) {
  return JSON.stringify(first) === JSON.stringify(second);
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
  exampleCharacters,
  maxExampleContextCharacters,
  focusTemplates,
}: iUseCharacterAssistantWorkspaceOptions) {
  const WORKSPACE_LOGGER = useMemo(() => CHARACTER_ASSISTANT_WORKSPACE_LOGGER.child({ characterId }), [characterId]);
  const sessions = usePersistentCollection(characterAssistantSessionsCollection);
  const drafts = usePersistentCollection(characterAssistantComposerDraftsCollection);
  const characterSessions = useMemo(
    () => sortAssistantSessions(sessions.filter((candidate) => candidate.characterId === characterId)),
    [characterId, sessions],
  );
  const [selectedSessionId, setSelectedSessionId] = useQueryState('chat', parseAsString);
  const session =
    characterSessions.find((candidate) => candidate.id === selectedSessionId) ?? characterSessions[0] ?? null;
  const sessionId = session?.id ?? characterId;
  const storedComposerDraft = drafts.find((draft) => draft.characterId === characterId) ?? null;
  const forwardedProps = useMemo<Record<string, unknown>>(() => ({ characterId }), [characterId]);
  Object.assign(forwardedProps, {
    characterId,
    provider: generationSettings.provider,
    endpoint: generationSettings.endpoint,
    apiKey,
    model: generationSettings.model,
    openRouterProvider: generationSettings.openRouterProvider,
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
    globalCharacterInstruction: generationSettings.globalCharacterInstruction,
    generalCharacterIdea,
    contextAttachments,
    exampleCharacters,
    maxExampleContextCharacters,
    templates: focusTemplates,
    fieldShouldAllowAssistantEditing: generationSettings.fieldShouldAllowAssistantEditing,
  });
  const chat = useChat({
    threadId: sessionId,
    initialMessages: session?.messages ?? [],
    connection: fetchServerSentEvents('/api/character-assistant'),
    forwardedProps,
    ...(generationSettings.assistantGenerationMode === CHARACTER_ASSISTANT_GENERATION_MODES['structured-output']
      ? { outputSchema: ASSISTANT_FINAL_RESPONSE_SCHEMA }
      : {}),
    devtools: { name: 'Character Assistant' },
  });

  useEffect(() => {
    if (!chat.error) return;
    WORKSPACE_LOGGER.error('Assistant stream failed', chat.error, { operation: 'stream', sessionId });
  }, [chat.error, sessionId, WORKSPACE_LOGGER]);

  useEffect(() => {
    if (!characterId || session) return;
    void ensureCharacterAssistantSession(sessionId, characterId).then((createdSession) => {
      void setSelectedSessionId(createdSession.id);
    });
  }, [characterId, session, sessionId, setSelectedSessionId]);
  useEffect(() => {
    if (!session || selectedSessionId === session.id) return;
    void setSelectedSessionId(session.id);
  }, [selectedSessionId, session, setSelectedSessionId]);
  useEffect(() => {
    if (!characterId || storedComposerDraft) return;
    void ensureCharacterAssistantComposerDraft(characterId);
  }, [characterId, storedComposerDraft]);

  useEffect(() => {
    if (!session) return;
    const hasMessageChanges = !areMessagesEqual(session.messages, chat.messages);
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
    if (!hasMessageChanges && missingProposals.length === 0 && !newConcept) {
      return;
    }
    if (newConcept) updateGeneralCharacterIdea(newConcept.concept.premise);
    void updateCharacterAssistantSession(session.id, (draft) => {
      if (hasMessageChanges) {
        draft.messages = structuredClone(chat.messages);
      }
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
    sessionId,
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
      const mentionTemplates = options.templates ?? [];
      forwardedProps.templates = [
        ...mentionTemplates,
        ...focusTemplates.filter((template) => !mentionTemplates.some((mention) => mention.id === template.id)),
      ].slice(0, MAX_CHAT_TEMPLATE_REF_COUNT);
      try {
        const attachments = options.attachments ?? [];
        await chat.sendMessage(
          attachments.length > 0 ? { content: buildChatInputContentParts(input, attachments) } : input,
        );
        return true;
      } catch (error) {
        WORKSPACE_LOGGER.error('Assistant message request failed', error, {
          operation: 'send-message',
          sessionId,
        });
        toastError(
          'Character Assistant failed',
          error instanceof Error ? error.message : 'Character assistant failed.',
        );
        return false;
      }
    },
    [chat, focusTemplates, forwardedProps, sessionId, WORKSPACE_LOGGER],
  );
  const replaceConversationMessages = useCallback(
    async (nextMessages: typeof chat.messages) => {
      chat.setMessages(nextMessages);
      const retainedProposalIds = readProposalIds(nextMessages);
      await updateCharacterAssistantSession(sessionId, (draft) => {
        draft.messages = structuredClone(nextMessages);
        draft.proposals = draft.proposals.filter((proposal) => retainedProposalIds.has(proposal.id));
        if (draft.lastRecordedConceptToolCallId && !hasToolCall(nextMessages, draft.lastRecordedConceptToolCallId)) {
          draft.lastRecordedConceptToolCallId = null;
        }
      });
    },
    [chat, sessionId],
  );
  const deleteConversationFromMessage = useCallback(
    async (messageId: string) => {
      if (chat.isLoading) return;
      const messageIndex = chat.messages.findIndex((message) => message.id === messageId);
      if (messageIndex < 0) throw new Error('The selected conversation message is unavailable.');
      await replaceConversationMessages(chat.messages.slice(0, messageIndex));
    },
    [chat.isLoading, chat.messages, replaceConversationMessages],
  );
  const editLastUserMessage = useCallback(
    async (messageId: string, content: string) => {
      if (chat.isLoading) return;
      const trimmedContent = content.trim();
      if (!trimmedContent) throw new Error('A message cannot be empty.');
      const messageIndex = chat.messages.findIndex((message) => message.id === messageId);
      const message = chat.messages[messageIndex];
      const lastUserMessageIndex = chat.messages.findLastIndex((candidate) => candidate.role === 'user');
      if (message?.role !== 'user' || messageIndex !== lastUserMessageIndex) {
        throw new Error('Only the latest user message can be edited.');
      }
      const editablePartIndex = message.parts.findIndex(
        (part) => part.type === 'text' && !readChatAttachmentMetadata('metadata' in part ? part.metadata : undefined),
      );
      if (editablePartIndex < 0) throw new Error('This message does not contain editable text.');

      const editedMessage = structuredClone(message);
      const editablePart = editedMessage.parts[editablePartIndex];
      if (editablePart?.type !== 'text') throw new Error('This message does not contain editable text.');
      editablePart.content = trimmedContent;
      await replaceConversationMessages([...chat.messages.slice(0, messageIndex), editedMessage]);
      await chat.reload();
    },
    [chat, replaceConversationMessages],
  );
  const clearConversation = useCallback(async () => {
    chat.clear();
    await Promise.all([
      clearCharacterAssistantComposerDraft(characterId),
      updateCharacterAssistantSession(sessionId, (draft) => {
        draft.messages = [];
        draft.proposals = [];
        draft.lastRecordedConceptToolCallId = null;
      }),
    ]);
  }, [characterId, chat, sessionId]);
  const createConversation = useCallback(async () => {
    if (chat.isLoading) chat.stop();
    const createdSession = await createCharacterAssistantSessionRecord(characterId);
    await clearCharacterAssistantComposerDraft(characterId);
    await setSelectedSessionId(createdSession.id);
  }, [characterId, chat, setSelectedSessionId]);
  const selectConversation = useCallback(
    (nextSessionId: string) => {
      if (chat.isLoading || !characterSessions.some((candidate) => candidate.id === nextSessionId)) return;
      void setSelectedSessionId(nextSessionId);
    },
    [characterSessions, chat.isLoading, setSelectedSessionId],
  );
  const deleteConversation = useCallback(
    async (sessionIdToDelete: string) => {
      if (chat.isLoading) return;
      const remainingSessions = characterSessions.filter((candidate) => candidate.id !== sessionIdToDelete);
      if (remainingSessions.length === 0) {
        const replacementSession = await createCharacterAssistantSessionRecord(characterId);
        await setSelectedSessionId(replacementSession.id);
      } else if (sessionIdToDelete === sessionId) {
        await setSelectedSessionId(remainingSessions[0]?.id ?? null);
      }
      await removeCharacterAssistantSession(sessionIdToDelete);
    },
    [characterId, characterSessions, chat.isLoading, sessionId, setSelectedSessionId],
  );
  return {
    sessionId,
    sessions: characterSessions,
    focusTemplates,
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
        WORKSPACE_LOGGER.error('Assistant response retry failed', error, {
          operation: 'response-retry',
          sessionId,
        });
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
    deleteConversationFromMessage,
    editLastUserMessage,
  };
}
