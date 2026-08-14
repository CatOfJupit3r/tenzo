import { createContext } from 'react';

export interface iCharacterCreatorActions {
  openImportDialog: () => unknown;
  openExportDialog: () => unknown;
  handleCreateCharacter: () => string;
  createProvisionalCharacter: () => string;
  handleSelectCharacter: (id: string) => unknown;
  handleDuplicateCharacter: (id: string) => Promise<unknown>;
  handleRemoveCharacter: (id: string) => Promise<unknown>;
  discardProvisionalCharacter: (id: string) => Promise<void>;
}

export const CharacterCreatorActionsContext = createContext<iCharacterCreatorActions | null>(null);
