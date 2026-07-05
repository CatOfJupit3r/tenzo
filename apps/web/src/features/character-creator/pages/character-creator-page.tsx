import { CharacterCreatorLayout } from '../components/character-creator-layout';
import { CharacterCreatorProvider } from '../context/character-creator-context/character-creator-context.provider';

export function CharacterCreatorPage() {
  return (
    <CharacterCreatorProvider>
      <CharacterCreatorLayout />
    </CharacterCreatorProvider>
  );
}
