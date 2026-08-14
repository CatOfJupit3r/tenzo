import { createContext } from 'react';

import type { useCharacterAssistantWorkspace } from '../hooks/use-character-assistant-workspace';
import type {
  CharacterAssistantFocus,
  iCharacterAssistantContextAttachment,
} from '../lib/character-assistant-contracts';
import type { CharacterEditFieldKey } from '../lib/character-edit-proposal';

export interface iCharacterAssistantContextValue {
  isAssistantOpen: boolean;
  assistantFocus: CharacterAssistantFocus;
  contextAttachments: iCharacterAssistantContextAttachment[];
  workspace: ReturnType<typeof useCharacterAssistantWorkspace>;
  openAssistant: () => void;
  openAssistantForField: (fieldKey: CharacterEditFieldKey) => void;
  closeAssistant: () => void;
  addContextAttachment: (attachment: iCharacterAssistantContextAttachment) => void;
  removeContextAttachment: (attachmentId: string) => void;
}

export const CharacterAssistantContext = createContext<iCharacterAssistantContextValue | null>(null);
