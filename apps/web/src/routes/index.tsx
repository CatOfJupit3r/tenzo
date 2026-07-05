import { createFileRoute } from '@tanstack/react-router';

import { CharacterCreatorPage } from '@~/features/character-creator/pages/character-creator-page';

export const Route = createFileRoute('/')({
  component: CharacterCreatorPage,
});
