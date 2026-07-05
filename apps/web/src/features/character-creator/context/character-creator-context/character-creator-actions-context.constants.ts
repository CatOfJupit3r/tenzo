import { createContext } from 'react';

export interface iCharacterCreatorActions {
  openImportDialog: () => unknown;
  openExportDialog: () => unknown;
  handleCreateCharacter: () => unknown;
  handleSelectCharacter: (id: string) => unknown;
  handleDuplicateCharacter: (id: string) => Promise<unknown>;
  handleRemoveCharacter: (id: string) => Promise<unknown>;
}

export const CharacterCreatorActionsContext = createContext<iCharacterCreatorActions | null>(null);
