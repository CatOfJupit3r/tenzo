import { useLiveQuery } from '@tanstack/react-db';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { toastError, toastSuccess } from '@~/components/toastifications/create-jsx-toasts';

import { characterAgentSessionsCollection } from '../collections/character-agent-sessions.collection';
import { CHARACTER_TEXT_FIELD_KEYS } from '../lib/card-schema';
import type { CharacterCard } from '../lib/card-schema';
import { CHARACTER_AGENT_STREAM_EVENT_SCHEMA } from '../lib/character-agent-contracts';
import {
  createCharacterAgentMessage,
  createCharacterAgentSession,
  CHARACTER_AGENT_MESSAGE_ROLES,
} from '../lib/character-agent-session';
import type { iCharacterAgentSession } from '../lib/character-agent-session';
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

const textDecoder = new TextDecoder();

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

async function readErrorMessage(response: Response) {
  const responseText = await response.text();

  return responseText.trim() || 'Character agent failed.';
}

function parseServerEventChunk(eventChunk: string) {
  const lines = eventChunk.split(/\r?\n/);
  let eventType = '';
  const dataLines: string[] = [];

  lines.forEach((line) => {
    if (line.startsWith('event:')) {
      eventType = line.slice('event:'.length).trim();
      return;
    }

    if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trim());
    }
  });

  if (!eventType || dataLines.length === 0) {
    return null;
  }

  const eventPayload = JSON.parse(dataLines.join('\n')) as unknown;
  const parsedEvent = CHARACTER_AGENT_STREAM_EVENT_SCHEMA.parse(eventPayload);

  if (parsedEvent.type !== eventType) {
    throw new Error('Character agent stream event type mismatch.');
  }

  return parsedEvent;
}

async function consumeCharacterAgentStream(
  response: Response,
  onEvent: (event: NonNullable<ReturnType<typeof parseServerEventChunk>>) => unknown,
) {
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const reader = response.body?.getReader();

  if (!reader) {
    throw new Error('Character agent response stream is unavailable.');
  }

  let buffer = '';

  while (true) {
    const readResult = await reader.read();

    if (readResult.done) {
      break;
    }

    buffer += textDecoder.decode(readResult.value, { stream: true });

    while (true) {
      const delimiterIndex = buffer.indexOf('\n\n');

      if (delimiterIndex === -1) {
        break;
      }

      const eventChunk = buffer.slice(0, delimiterIndex);

      buffer = buffer.slice(delimiterIndex + 2);

      if (!eventChunk.trim()) {
        continue;
      }

      const parsedEvent = parseServerEventChunk(eventChunk);

      if (parsedEvent) {
        onEvent(parsedEvent);
      }
    }
  }

  const trailingChunk = buffer.trim();

  if (!trailingChunk) {
    return;
  }

  const parsedEvent = parseServerEventChunk(trailingChunk);

  if (parsedEvent) {
    onEvent(parsedEvent);
  }
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
        return;
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
        const sessionSnapshot = characterAgentSessionsCollection.get(sessionId);

        if (!sessionSnapshot) {
          throw new Error('Character agent session is unavailable.');
        }

        let assistantMessageId: string | null = null;
        let assistantMessageText = '';
        const response = await fetch('/api/character-agent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
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
            generalCharacterIdea,
            draftCard: sessionSnapshot.draftCard,
            messages: sessionSnapshot.messages,
          }),
        });

        await consumeCharacterAgentStream(response, (streamEvent) => {
          if (streamEvent.type === 'text-delta') {
            assistantMessageText += streamEvent.textDelta;

            updateSession(sessionId, (draft) => {
              const existingAssistantMessage = assistantMessageId
                ? draft.messages.find((message) => message.id === assistantMessageId)
                : null;

              if (existingAssistantMessage) {
                existingAssistantMessage.content = assistantMessageText;
                return;
              }

              const assistantMessage = createCharacterAgentMessage({
                role: CHARACTER_AGENT_MESSAGE_ROLES.assistant,
                content: assistantMessageText,
              });

              assistantMessageId = assistantMessage.id;
              draft.messages.push(assistantMessage);
            });

            return;
          }

          if (streamEvent.type === 'tool-event') {
            updateSession(sessionId, (draft) => {
              draft.draftCard = structuredClone(streamEvent.draftCard);
              draft.toolEvents.push(streamEvent.toolEvent);
            });

            return;
          }

          if (streamEvent.type === 'complete') {
            assistantMessageText = streamEvent.assistantMessage;

            updateSession(sessionId, (draft) => {
              draft.draftCard = structuredClone(streamEvent.draftCard);

              const existingAssistantMessage = assistantMessageId
                ? draft.messages.find((message) => message.id === assistantMessageId)
                : null;

              if (existingAssistantMessage) {
                existingAssistantMessage.content = assistantMessageText;
                return;
              }

              const assistantMessage = createCharacterAgentMessage({
                role: CHARACTER_AGENT_MESSAGE_ROLES.assistant,
                content: assistantMessageText,
              });

              assistantMessageId = assistantMessage.id;
              draft.messages.push(assistantMessage);
            });

            return;
          }

          throw new Error(streamEvent.message);
        });

        setRuntimeState({
          isRunning: false,
          errorMessage: null,
        });
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
