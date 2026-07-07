import { useLiveQuery } from '@tanstack/react-db';
import type { ModelMessage } from 'ai';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { toastError, toastSuccess } from '@~/components/toastifications/create-jsx-toasts';

import { characterAgentSessionsCollection } from '../collections/character-agent-sessions.collection';
import { CHARACTER_TEXT_FIELD_KEYS } from '../lib/card-schema';
import type { CharacterCard } from '../lib/card-schema';
import { createCharacterAgent } from '../lib/character-agent';
import {
  createCharacterAgentMessage,
  createCharacterAgentSession,
  CHARACTER_AGENT_MESSAGE_ROLES,
} from '../lib/character-agent-session';
import type { iCharacterAgentSession, iCharacterAgentToolEvent } from '../lib/character-agent-session';
import type { iCharacterGenerationSettings } from '../lib/generation-config';

interface iUseCharacterAgentWorkspaceOptions {
  characterId: string;
  card: CharacterCard;
  replaceCard: (nextCard: CharacterCard) => void;
  apiKey: string;
  generationSettings: iCharacterGenerationSettings;
  generalCharacterIdea?: string;
  shouldSendDisabledSamplers?: boolean;
}

interface iCharacterAgentRuntimeState {
  isRunning: boolean;
  errorMessage: string | null;
}

const MAX_CHARACTER_AGENT_STEPS = 8;

function cardsMatch(leftCard: CharacterCard, rightCard: CharacterCard) {
  return JSON.stringify(leftCard) === JSON.stringify(rightCard);
}

function summarizeChangedSections(liveCard: CharacterCard, draftCard: CharacterCard) {
  const changedSections: string[] = CHARACTER_TEXT_FIELD_KEYS.filter(
    (fieldKey) => liveCard.data[fieldKey] !== draftCard.data[fieldKey],
  );

  if (JSON.stringify(liveCard.data.tags) !== JSON.stringify(draftCard.data.tags)) {
    changedSections.push('tags');
  }

  if (JSON.stringify(liveCard.data.alternate_greetings) !== JSON.stringify(draftCard.data.alternate_greetings)) {
    changedSections.push('alternate_greetings');
  }

  if (
    JSON.stringify(liveCard.data.extensions.custom_fields) !== JSON.stringify(draftCard.data.extensions.custom_fields)
  ) {
    changedSections.push('custom_fields');
  }

  return changedSections;
}

function buildDraftPreview(card: CharacterCard) {
  return [
    `Name: ${card.data.name}`,
    '',
    `Description:\n${card.data.description}`,
    '',
    `Personality:\n${card.data.personality}`,
    '',
    `Scenario:\n${card.data.scenario}`,
    '',
    `First Message:\n${card.data.first_mes}`,
  ].join('\n');
}

function updateSessionTimestamp(session: { updatedAt: string }) {
  session.updatedAt = new Date().toISOString();
}

export function useCharacterAgentWorkspace({
  characterId,
  card,
  replaceCard,
  apiKey,
  generationSettings,
  generalCharacterIdea = '',
  shouldSendDisabledSamplers = false,
}: iUseCharacterAgentWorkspaceOptions) {
  const [runtimeState, setRuntimeState] = useState<iCharacterAgentRuntimeState>({
    isRunning: false,
    errorMessage: null,
  });
  const { data: storedSessions } = useLiveQuery((query) =>
    query.from({ session: characterAgentSessionsCollection }).orderBy(({ session }) => session.updatedAt, 'desc'),
  );

  const session = useMemo(
    () => storedSessions.find((storedSession) => storedSession.characterId === characterId) ?? null,
    [characterId, storedSessions],
  );

  useEffect(() => {
    if (session || !characterId) {
      return;
    }

    characterAgentSessionsCollection.insert(
      createCharacterAgentSession({
        characterId,
        card,
      }),
    );
  }, [card, characterId, session]);

  const updateSession = useCallback((sessionId: string, recipe: (draft: iCharacterAgentSession) => unknown) => {
    if (!characterAgentSessionsCollection.has(sessionId)) {
      return;
    }

    characterAgentSessionsCollection.update(sessionId, (draft) => {
      recipe(draft as iCharacterAgentSession);
      updateSessionTimestamp(draft);
    });
  }, []);

  const ensureSessionId = useCallback(() => {
    if (session) {
      return session.id;
    }

    const nextSession = createCharacterAgentSession({
      characterId,
      card,
    });
    characterAgentSessionsCollection.insert(nextSession);
    return nextSession.id;
  }, [card, characterId, session]);

  const draftCard = session?.draftCard ?? card;
  const changedSections = useMemo(() => summarizeChangedSections(card, draftCard), [card, draftCard]);
  const hasDraftChanges = changedSections.length > 0;
  const isConnectionConfigured = Boolean(
    generationSettings.endpoint.trim() && generationSettings.model.trim() && apiKey.trim(),
  );
  const draftPreview = useMemo(() => buildDraftPreview(draftCard), [draftCard]);

  const resetSessionFromCharacter = useCallback(() => {
    const sessionId = ensureSessionId();

    updateSession(sessionId, (draft) => {
      draft.draftCard = structuredClone(card);
      draft.messages = [];
      draft.toolEvents = [];
    });
  }, [card, ensureSessionId, updateSession]);

  const clearConversation = useCallback(() => {
    if (!session) {
      return;
    }

    updateSession(session.id, (draft) => {
      draft.messages = [];
      draft.toolEvents = [];
    });
  }, [session, updateSession]);

  const applyDraftToCharacter = useCallback(() => {
    replaceCard(structuredClone(draftCard));
    toastSuccess('Draft applied', 'The agent draft is now the active character card.');
  }, [draftCard, replaceCard]);

  const sendMessage = useCallback(
    async (input: string) => {
      const trimmedInput = input.trim();

      if (!trimmedInput) {
        return undefined;
      }

      if (!isConnectionConfigured) {
        const errorMessage = 'Set an endpoint, model, and API key before running the character agent.';
        setRuntimeState({
          isRunning: false,
          errorMessage,
        });
        throw new Error(errorMessage);
      }

      const sessionId = ensureSessionId();
      const userMessage = createCharacterAgentMessage({
        role: CHARACTER_AGENT_MESSAGE_ROLES.user,
        content: trimmedInput,
      });

      updateSession(sessionId, (draft) => {
        draft.messages.push(userMessage);
      });

      setRuntimeState({
        isRunning: true,
        errorMessage: null,
      });

      try {
        const store = {
          getDraftCard: () =>
            structuredClone(characterAgentSessionsCollection.get(sessionId)?.draftCard ?? structuredClone(card)),
          replaceDraftCard: (nextCard: CharacterCard) => {
            updateSession(sessionId, (draft) => {
              draft.draftCard = structuredClone(nextCard);
            });
          },
          appendToolEvent: (event: iCharacterAgentToolEvent) => {
            updateSession(sessionId, (draft) => {
              draft.toolEvents.push(event);
            });
          },
        };
        const agent = createCharacterAgent({
          card: store.getDraftCard(),
          apiKey,
          generationSettings,
          generalCharacterIdea,
          shouldSendDisabledSamplers,
          store,
        });
        const currentMessages: ModelMessage[] =
          characterAgentSessionsCollection.get(sessionId)?.messages.map((message) => ({
            role: message.role,
            content: message.content,
          })) ?? [];
        const result = await agent.generate(currentMessages, {
          maxSteps: MAX_CHARACTER_AGENT_STEPS,
          modelSettings: {
            maxOutputTokens: Math.max(1, Math.floor(generationSettings.maxTokens)),
            temperature: generationSettings.temperature,
            topP: generationSettings.topP,
            frequencyPenalty: generationSettings.frequencyPenalty,
            presencePenalty: generationSettings.presencePenalty,
          },
        });
        const assistantMessage = createCharacterAgentMessage({
          role: CHARACTER_AGENT_MESSAGE_ROLES.assistant,
          content: result.text.trim() || 'The draft is ready for review.',
        });

        updateSession(sessionId, (draft) => {
          draft.messages.push(assistantMessage);
        });

        setRuntimeState({
          isRunning: false,
          errorMessage: null,
        });

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Character agent failed.';

        setRuntimeState({
          isRunning: false,
          errorMessage,
        });
        toastError('Character agent failed', errorMessage);
        throw error;
      }
    },
    [
      apiKey,
      card,
      ensureSessionId,
      generalCharacterIdea,
      generationSettings,
      isConnectionConfigured,
      shouldSendDisabledSamplers,
      updateSession,
    ],
  );

  return {
    draftCard,
    draftPreview,
    changedSections,
    hasDraftChanges,
    isConnectionConfigured,
    messages: session?.messages ?? [],
    toolEvents: session?.toolEvents ?? [],
    isRunning: runtimeState.isRunning,
    errorMessage: runtimeState.errorMessage,
    clearConversation,
    resetSessionFromCharacter,
    applyDraftToCharacter,
    sendMessage,
    isDraftInSyncWithCharacter: cardsMatch(card, draftCard),
  };
}
