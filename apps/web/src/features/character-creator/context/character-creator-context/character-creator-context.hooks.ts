import { useContext } from 'react';

import { CharacterCreatorContext } from './character-creator-context.constants';

export function useCharacterCreatorContext() {
  const value = useContext(CharacterCreatorContext);

  if (!value) {
    throw new Error('useCharacterCreatorContext must be used inside CharacterCreatorProvider.');
  }

  return value;
}
