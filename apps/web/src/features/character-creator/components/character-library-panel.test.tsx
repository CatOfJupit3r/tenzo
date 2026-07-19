import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CharacterLibraryPanel } from './character-library-panel';

const mocks = vi.hoisted(() => ({
  handleCreateCharacter: vi.fn(() => 'created-character'),
  createProvisionalCharacter: vi.fn(() => 'created-character'),
  handleDuplicateCharacter: vi.fn(),
  discardProvisionalCharacter: vi.fn(async () => undefined),
  handleRemoveCharacter: vi.fn(async () => undefined),
  handleSelectCharacter: vi.fn(),
  openAssistantInGuidedMode: vi.fn(async () => undefined),
  closeAssistant: vi.fn(),
  onGuidedStartFailure: vi.fn(),
  openImportDialog: vi.fn(),
  isConnectionConfigured: true,
}));

vi.mock('jotai', () => ({
  useAtomValue: vi.fn(() => null),
}));

vi.mock('../context/character-assistant-context.hooks', () => ({
  useCharacterAssistant: vi.fn(() => ({
    openAssistantInGuidedMode: mocks.openAssistantInGuidedMode,
    closeAssistant: mocks.closeAssistant,
    workspace: {
      isConnectionConfigured: mocks.isConnectionConfigured,
    },
  })),
}));

vi.mock('../context/character-creator-context/character-creator-actions-context.hooks', () => ({
  useCharacterCreatorActions: vi.fn(() => ({
    handleCreateCharacter: mocks.handleCreateCharacter,
    createProvisionalCharacter: mocks.createProvisionalCharacter,
    handleSelectCharacter: mocks.handleSelectCharacter,
    handleDuplicateCharacter: mocks.handleDuplicateCharacter,
    discardProvisionalCharacter: mocks.discardProvisionalCharacter,
    handleRemoveCharacter: mocks.handleRemoveCharacter,
    openImportDialog: mocks.openImportDialog,
  })),
}));

vi.mock('../hooks/use-character-library-list', () => ({
  useCharacterLibraryList: vi.fn(() => ({
    characterLibrary: [],
    isCharacterLibraryReady: true,
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isConnectionConfigured = true;
});

describe('CharacterLibraryPanel guided creation', () => {
  it('blocks creation and explains connection setup when configuration is incomplete', async () => {
    mocks.isConnectionConfigured = false;
    const user = userEvent.setup();
    render(<CharacterLibraryPanel isOpen onClose={vi.fn()} onGuidedStartFailure={mocks.onGuidedStartFailure} />);

    await user.click(screen.getByRole('button', { name: 'Start guided creation' }));

    expect(mocks.handleCreateCharacter).not.toHaveBeenCalled();
    expect(mocks.createProvisionalCharacter).not.toHaveBeenCalled();
    expect(mocks.openAssistantInGuidedMode).not.toHaveBeenCalled();
    expect(mocks.closeAssistant).not.toHaveBeenCalled();
    expect(mocks.onGuidedStartFailure).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain(
      'Open Settings > Connection and set an endpoint, model, and API key.',
    );
  });

  it('silently discards only its provisional character and preserves the premise when discovery fails', async () => {
    const user = userEvent.setup();
    mocks.openAssistantInGuidedMode.mockRejectedValueOnce(new Error('Provider request failed.'));
    render(<CharacterLibraryPanel isOpen onClose={vi.fn()} onGuidedStartFailure={mocks.onGuidedStartFailure} />);

    const premiseInput = screen.getByLabelText('Create from a broad premise');
    await user.type(premiseInput, 'A scholar wakes the archive beneath the sea.');
    await user.click(screen.getByRole('button', { name: 'Discover directions' }));

    expect(mocks.createProvisionalCharacter).toHaveBeenCalledTimes(1);
    expect(mocks.handleCreateCharacter).not.toHaveBeenCalled();
    expect(mocks.discardProvisionalCharacter).toHaveBeenCalledWith('created-character');
    expect(mocks.handleRemoveCharacter).not.toHaveBeenCalled();
    expect(mocks.closeAssistant).toHaveBeenCalledTimes(1);
    expect(mocks.onGuidedStartFailure).toHaveBeenCalledTimes(1);
    expect((premiseInput as HTMLInputElement).value).toBe('A scholar wakes the archive beneath the sea.');
    expect(screen.getByRole('alert').textContent).toContain('Provider request failed.');
  });

  it('clears the premise after one successful guided discovery start', async () => {
    const user = userEvent.setup();
    render(<CharacterLibraryPanel isOpen onClose={vi.fn()} onGuidedStartFailure={mocks.onGuidedStartFailure} />);

    const premiseInput = screen.getByLabelText('Create from a broad premise');
    await user.type(premiseInput, 'A clockmaker repairs memories for ghosts.');
    await user.click(screen.getByRole('button', { name: 'Discover directions' }));

    expect(mocks.openAssistantInGuidedMode).toHaveBeenCalledWith('created-character', {
      mode: 'discovery',
      originalPremise: 'A clockmaker repairs memories for ghosts.',
    });
    expect(mocks.createProvisionalCharacter).toHaveBeenCalledTimes(1);
    expect(mocks.handleCreateCharacter).not.toHaveBeenCalled();
    expect(mocks.discardProvisionalCharacter).not.toHaveBeenCalled();
    expect(mocks.closeAssistant).not.toHaveBeenCalled();
    expect(mocks.onGuidedStartFailure).not.toHaveBeenCalled();
    expect((premiseInput as HTMLInputElement).value).toBe('');
  });
});
