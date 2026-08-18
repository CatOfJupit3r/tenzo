import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { createCharacterLibraryItem } from '../lib/cards/character-library';
import { CharacterSwitcherView } from './character-switcher';

describe('CharacterSwitcher', () => {
  it('requires confirmation before deleting a character', async () => {
    const character = createCharacterLibraryItem({ id: 'character-1' });
    character.card.data.name = 'Mira Quill';
    const handleRemoveCharacterMock = vi.fn(async () => undefined);
    const user = userEvent.setup();
    render(
      <CharacterSwitcherView
        characterLibrary={[character]}
        activeCharacterId="character-1"
        isCharacterLibraryReady
        onCreateCharacter={() => undefined}
        onRemoveCharacter={handleRemoveCharacterMock}
        onSelectCharacter={() => undefined}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Delete Mira Quill' }));
    expect(screen.getByRole('alertdialog', { name: 'Delete Mira Quill?' })).toBeTruthy();
    expect(handleRemoveCharacterMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(handleRemoveCharacterMock).toHaveBeenCalledOnce();
    expect(handleRemoveCharacterMock).toHaveBeenCalledWith('character-1');
  });
});
