import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createCharacterLibraryItem } from '../lib/cards/character-library';
import type { iCharacterLibraryItem } from '../lib/cards/character-library';
import { CharacterSwitcher } from './character-switcher';

const { handleRemoveCharacterMock, switcherTestState } = vi.hoisted(() => ({
  handleRemoveCharacterMock: vi.fn(),
  switcherTestState: { characterLibrary: [] as iCharacterLibraryItem[] },
}));

vi.mock('jotai', async () => ({
  ...(await vi.importActual<Record<string, unknown>>('jotai')),
  useAtomValue: vi.fn(() => 'character-1'),
}));

vi.mock('../hooks/use-character-library-list', () => ({
  useCharacterLibraryList: () => ({
    characterLibrary: switcherTestState.characterLibrary,
    isCharacterLibraryReady: true,
  }),
}));

vi.mock('../context/character-creator-context/character-creator-context.hooks', () => ({
  useCharacterCreatorContext: () => ({ activeCharacterId: 'character-1' }),
}));

vi.mock('../context/character-creator-context/character-creator-actions-context.hooks', () => ({
  useCharacterCreatorActions: () => ({
    handleCreateCharacter: vi.fn(),
    handleSelectCharacter: vi.fn(),
    handleRemoveCharacter: handleRemoveCharacterMock,
  }),
}));

describe('CharacterSwitcher', () => {
  beforeEach(() => {
    const character = createCharacterLibraryItem({ id: 'character-1' });
    character.card.data.name = 'Mira Quill';
    switcherTestState.characterLibrary = [character];
    handleRemoveCharacterMock.mockReset();
    handleRemoveCharacterMock.mockResolvedValue(undefined);
  });

  it('requires confirmation before deleting a character', async () => {
    const user = userEvent.setup();
    render(<CharacterSwitcher />);

    await user.click(screen.getByRole('button', { name: 'Delete Mira Quill' }));
    expect(screen.getByRole('alertdialog', { name: 'Delete Mira Quill?' })).toBeTruthy();
    expect(handleRemoveCharacterMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(handleRemoveCharacterMock).toHaveBeenCalledOnce();
    expect(handleRemoveCharacterMock).toHaveBeenCalledWith('character-1');
  });
});
