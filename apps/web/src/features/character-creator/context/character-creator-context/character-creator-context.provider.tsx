import type { ReactNode } from 'react';

import { useCharacterCreatorPage } from '../../hooks/use-character-creator-page';
import { CharacterCreatorContext } from './character-creator-context.constants';

export function CharacterCreatorProvider({ children }: { children: ReactNode }) {
  const value = useCharacterCreatorPage();

  return <CharacterCreatorContext.Provider value={value}>{children}</CharacterCreatorContext.Provider>;
}
