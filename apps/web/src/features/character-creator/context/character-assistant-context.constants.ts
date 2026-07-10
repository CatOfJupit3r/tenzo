import { createContext } from 'react';

import type { useCharacterAssistantWorkspace } from '../hooks/use-character-assistant-workspace';
import type { useGuidedCharacterFlow } from '../hooks/use-guided-character-flow';
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
  guidedFlow: ReturnType<typeof useGuidedCharacterFlow>;
  openAssistant: () => void;
  openAssistantForField: (fieldKey: CharacterEditFieldKey) => void;
  openAssistantInGuidedMode: (characterId: string) => Promise<void>;
  closeAssistant: () => void;
  addContextAttachment: (attachment: iCharacterAssistantContextAttachment) => void;
  removeContextAttachment: (attachmentId: string) => void;
}

export const CharacterAssistantContext = createContext<iCharacterAssistantContextValue | null>(null);
