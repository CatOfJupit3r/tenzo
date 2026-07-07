import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useEffect, useMemo, useRef } from 'react';

import type { CharacterCard, CharacterTextFieldKey } from '../lib/card-schema';
import type { iCharacterGenerationSettings } from '../lib/generation-config';
import { extractUiMessageText } from '../lib/revise-session/revise-session-message';

export interface iUseCharacterReviseSessionOptions {
  card: CharacterCard;
  fieldKey: CharacterTextFieldKey;
  apiKey: string;
  generationSettings: iCharacterGenerationSettings;
  shouldSendDisabledSamplers?: boolean;
  generalCharacterIdea?: string;
  shouldUseGeneralCharacterIdea?: boolean;
  fieldInstruction?: string;
}

interface iCharacterReviseTransportBody {
  endpoint: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  topK: number;
  minP: number;
  shouldSendDisabledSamplers?: boolean;
  card: CharacterCard;
  targetFieldKey: CharacterTextFieldKey;
  generalCharacterIdea?: string;
  fieldInstruction?: string;
}

export function useCharacterReviseSession({
  card,
  fieldKey,
  apiKey,
  generationSettings,
  shouldSendDisabledSamplers = false,
  generalCharacterIdea = '',
  shouldUseGeneralCharacterIdea = true,
  fieldInstruction = '',
}: iUseCharacterReviseSessionOptions) {
  const transportBodyRef = useRef<iCharacterReviseTransportBody>({
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
    card,
    targetFieldKey: fieldKey,
    generalCharacterIdea: shouldUseGeneralCharacterIdea ? generalCharacterIdea : '',
    fieldInstruction,
  });

  useEffect(() => {
    transportBodyRef.current = {
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
      card,
      targetFieldKey: fieldKey,
      generalCharacterIdea: shouldUseGeneralCharacterIdea ? generalCharacterIdea : '',
      fieldInstruction,
    };
  }, [
    apiKey,
    card,
    fieldInstruction,
    fieldKey,
    generalCharacterIdea,
    generationSettings.endpoint,
    generationSettings.frequencyPenalty,
    generationSettings.maxTokens,
    generationSettings.minP,
    generationSettings.model,
    generationSettings.presencePenalty,
    generationSettings.temperature,
    generationSettings.topK,
    generationSettings.topP,
    shouldSendDisabledSamplers,
    shouldUseGeneralCharacterIdea,
  ]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/character-revise',
        body: () => transportBodyRef.current,
      }),
    [],
  );

  const chat = useChat({
    transport,
  });
  const latestAssistantMessage = [...chat.messages].reverse().find((message) => message.role === 'assistant') ?? null;
  const latestRevision = latestAssistantMessage ? extractUiMessageText(latestAssistantMessage).trim() : '';
  const isConnectionConfigured = Boolean(
    generationSettings.endpoint.trim() && generationSettings.model.trim() && apiKey.trim(),
  );

  return {
    ...chat,
    latestRevision,
    isConnectionConfigured,
  };
}
