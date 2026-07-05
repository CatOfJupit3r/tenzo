import { useContext } from 'react';

import { CharacterCreatorActionsContext } from './character-creator-actions-context.constants';

export function useCharacterCreatorActions() {
  const value = useContext(CharacterCreatorActionsContext);

  if (!value) {
    throw new Error('useCharacterCreatorActions must be used inside CharacterCreatorProvider.');
  }

  return value;
}
