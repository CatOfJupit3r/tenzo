import { useContext } from 'react';

import { CharacterAssistantContext } from './character-assistant-context.constants';

export function useCharacterAssistant() {
  const context = useContext(CharacterAssistantContext);

  if (!context) {
    throw new Error('useCharacterAssistant must be used within CharacterAssistantProvider.');
  }

  return context;
}
