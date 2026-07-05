import { createContext } from 'react';

import type { useCharacterCreatorPage } from '../../hooks/use-character-creator-page';

type CharacterCreatorContextValue = ReturnType<typeof useCharacterCreatorPage>;

export const CharacterCreatorContext = createContext<CharacterCreatorContextValue | null>(null);
