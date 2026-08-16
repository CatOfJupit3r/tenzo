import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';

import { useCharacterAssistantWorkspace } from '../hooks/use-character-assistant-workspace';
import {
  CHARACTER_ASSISTANT_FOCUS_KINDS,
  MAX_CHAT_TEMPLATE_REF_COUNT,
} from '../lib/assistant/character-assistant-contracts';
import type {
  CharacterAssistantFocus,
  iCharacterAssistantContextAttachment,
  iChatTemplateRef,
} from '../lib/assistant/character-assistant-contracts';
import { CHARACTER_TEXT_FIELD_KEYS } from '../lib/cards/card-schema';
import { toPromptExampleCharacter } from '../lib/cards/example-characters';
import type { CharacterEditFieldKey } from '../lib/proposals/character-edit-proposal';
import { PROVIDER_KINDS } from '../lib/provider/provider-health';
import { CharacterAssistantContext } from './character-assistant-context.constants';
import { useCharacterCreatorContext } from './character-creator-context/character-creator-context.hooks';

const DEFAULT_ASSISTANT_FOCUS = {
  kind: CHARACTER_ASSISTANT_FOCUS_KINDS.card,
} satisfies CharacterAssistantFocus;

function getTemplateBindableFieldKeys(focus: CharacterAssistantFocus): readonly string[] {
  if (focus.kind === CHARACTER_ASSISTANT_FOCUS_KINDS.field) {
    return [focus.fieldKey];
  }

  if (focus.kind === CHARACTER_ASSISTANT_FOCUS_KINDS.fields) {
    return focus.fieldKeys;
  }

  return CHARACTER_TEXT_FIELD_KEYS;
}

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
    exampleCharacters,
    maxExampleContextCharacters,
    fieldTemplates,
  } = useCharacterCreatorContext();
  const [isAssistantOpen, setIsAssistantOpen] = useState(true);
  const [assistantFocus, setAssistantFocus] = useState<CharacterAssistantFocus>(DEFAULT_ASSISTANT_FOCUS);
  const [contextAttachments, setContextAttachments] = useState<iCharacterAssistantContextAttachment[]>([]);
  const previousCharacterIdRef = useRef(activeCharacterId);

  useEffect(() => {
    if (previousCharacterIdRef.current === activeCharacterId) {
      return;
    }

    previousCharacterIdRef.current = activeCharacterId;
    setAssistantFocus(DEFAULT_ASSISTANT_FOCUS);
    setContextAttachments([]);
  }, [activeCharacterId]);

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
  const promptExampleCharacters = useMemo(
    () => exampleCharacters.map((exampleCharacter) => toPromptExampleCharacter(exampleCharacter)),
    [exampleCharacters],
  );
  const focusTemplates = useMemo(() => {
    const focusedFieldKeys = getTemplateBindableFieldKeys(assistantFocus);
    const templates: iChatTemplateRef[] = [];

    focusedFieldKeys.forEach((fieldKey) => {
      const templateId = generationSettings.fieldTemplateIds[`field:${fieldKey}`];
      if (!templateId) return;
      const template = fieldTemplates.find((candidate) => candidate.id === templateId);
      if (!template || templates.some((existing) => existing.id === template.id)) return;
      templates.push({
        id: template.id,
        name: template.name,
        mode: template.mode,
        fieldKeys: template.fieldKeys,
        content: template.content,
      });
    });

    return templates.slice(0, MAX_CHAT_TEMPLATE_REF_COUNT);
  }, [assistantFocus, fieldTemplates, generationSettings.fieldTemplateIds]);
  const workspace = useCharacterAssistantWorkspace({
    characterId: activeCharacterId,
    card,
    replaceCard,
    apiKey,
    generationSettings,
    generalCharacterIdea,
    updateGeneralCharacterIdea,
    shouldSendDisabledSamplers: connectionHealth.providerKind === PROVIDER_KINDS.koboldcpp,
    providerKind: connectionHealth.providerKind,
    focus: assistantFocus,
    contextAttachments,
    exampleCharacters: promptExampleCharacters,
    maxExampleContextCharacters,
    focusTemplates,
  });
  const value = useMemo(
    () => ({
      isAssistantOpen,
      assistantFocus,
      contextAttachments,
      workspace,
      openAssistant,
      openAssistantForField,
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
    ],
  );

  return <CharacterAssistantContext value={value}>{children}</CharacterAssistantContext>;
}
