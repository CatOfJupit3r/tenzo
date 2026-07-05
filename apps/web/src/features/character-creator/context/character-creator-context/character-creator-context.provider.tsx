import type { ReactNode } from 'react';

import { useCharacterCreatorPage } from '../../hooks/use-character-creator-page';
import { CharacterCreatorActionsContext } from './character-creator-actions-context.constants';
import { CharacterCreatorContext } from './character-creator-context.constants';

export function CharacterCreatorProvider({ children }: { children: ReactNode }) {
  const value = useCharacterCreatorPage();

  return (
    <CharacterCreatorContext.Provider value={value}>
      <CharacterCreatorActionsContext.Provider value={value.actions}>
        {children}
      </CharacterCreatorActionsContext.Provider>
    </CharacterCreatorContext.Provider>
  );
}
