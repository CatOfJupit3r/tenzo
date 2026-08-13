import { useCallback, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';

import { useCharacterAssistantWorkspace } from '../hooks/use-character-assistant-workspace';
import { useGuidedCharacterFlow } from '../hooks/use-guided-character-flow';
import { CHARACTER_ASSISTANT_FOCUS_KINDS } from '../lib/character-assistant-contracts';
import type {
  CharacterAssistantFocus,
  iCharacterAssistantContextAttachment,
} from '../lib/character-assistant-contracts';
import type { CharacterEditFieldKey } from '../lib/character-edit-proposal';
import { PROVIDER_KINDS } from '../lib/provider-health';
import { CharacterAssistantContext } from './character-assistant-context.constants';
import { useCharacterCreatorContext } from './character-creator-context/character-creator-context.hooks';

const DEFAULT_ASSISTANT_FOCUS = {
  kind: CHARACTER_ASSISTANT_FOCUS_KINDS.card,
} satisfies CharacterAssistantFocus;

export function CharacterAssistantProvider({ children }: PropsWithChildren) {
  const {
    activeCharacterId,
    card,
    replaceCard,
    apiKey,
    generationSettings,
    generalCharacterIdea,
    updateGeneralCharacterIdea,
    connectionHealth,
  } = useCharacterCreatorContext();
  const [isAssistantOpen, setIsAssistantOpen] = useState(true);
  const [assistantFocus, setAssistantFocus] = useState<CharacterAssistantFocus>(DEFAULT_ASSISTANT_FOCUS);
  const [contextAttachments, setContextAttachments] = useState<iCharacterAssistantContextAttachment[]>([]);

  const openAssistant = useCallback(() => {
    setAssistantFocus(DEFAULT_ASSISTANT_FOCUS);
    setIsAssistantOpen(true);
  }, []);

  const openAssistantForField = useCallback((fieldKey: CharacterEditFieldKey) => {
    setAssistantFocus({
      kind: CHARACTER_ASSISTANT_FOCUS_KINDS.field,
      fieldKey,
    });
    setIsAssistantOpen(true);
  }, []);

  const closeAssistant = useCallback(() => setIsAssistantOpen(false), []);

  const addContextAttachment = useCallback((attachment: iCharacterAssistantContextAttachment) => {
    setContextAttachments((currentAttachments) => [
      ...currentAttachments.filter((currentAttachment) => currentAttachment.id !== attachment.id),
      attachment,
    ]);
  }, []);

  const removeContextAttachment = useCallback((attachmentId: string) => {
    setContextAttachments((currentAttachments) =>
      currentAttachments.filter((attachment) => attachment.id !== attachmentId),
    );
  }, []);
  const workspace = useCharacterAssistantWorkspace({
    characterId: activeCharacterId,
    card,
    replaceCard,
    apiKey,
    generationSettings,
    generalCharacterIdea,
    shouldSendDisabledSamplers: connectionHealth.providerKind === PROVIDER_KINDS.koboldcpp,
    providerKind: connectionHealth.providerKind,
    focus: assistantFocus,
    contextAttachments,
  });
  const guidedFlow = useGuidedCharacterFlow({
    characterId: activeCharacterId,
    apiKey,
    provider: generationSettings.provider,
    endpoint: generationSettings.endpoint,
    model: generationSettings.model,
    visionModel: generationSettings.visionModel.trim() || generationSettings.model,
    topP: generationSettings.topP,
    frequencyPenalty: generationSettings.frequencyPenalty,
    presencePenalty: generationSettings.presencePenalty,
    topK: generationSettings.topK,
    minP: generationSettings.minP,
    maxTokens: generationSettings.maxTokens,
    temperature: generationSettings.temperature,
    updateGeneralCharacterIdea,
    workspace,
  });

  const openAssistantInGuidedMode = useCallback(
    async (characterId: string, options: { mode?: 'direct' | 'discovery'; originalPremise?: string } = {}) => {
      const isDiscoveryMode = options.mode === 'discovery';
      const trimmedPremise = options.originalPremise?.trim();

      setAssistantFocus(DEFAULT_ASSISTANT_FOCUS);
      setIsAssistantOpen(true);

      if (isDiscoveryMode && trimmedPremise) {
        await guidedFlow.startGuidedDiscoverySession(trimmedPremise, characterId);
      } else {
        await guidedFlow.openGuidedSession(characterId);
      }
    },
    [guidedFlow],
  );

  const value = useMemo(
    () => ({
      isAssistantOpen,
      assistantFocus,
      contextAttachments,
      workspace,
      guidedFlow,
      openAssistant,
      openAssistantForField,
      openAssistantInGuidedMode,
      closeAssistant,
      addContextAttachment,
      removeContextAttachment,
    }),
    [
      addContextAttachment,
      assistantFocus,
      closeAssistant,
      contextAttachments,
      isAssistantOpen,
      openAssistant,
      openAssistantForField,
      removeContextAttachment,
      workspace,
      guidedFlow,
      openAssistantInGuidedMode,
    ],
  );

  return <CharacterAssistantContext value={value}>{children}</CharacterAssistantContext>;
}
