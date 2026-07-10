import { useState } from 'react';
import { LuChevronRight, LuDownload, LuFileUp, LuSettings, LuSparkles } from 'react-icons/lu';

import { Button } from '@~/components/ui/button';
import { cn } from '@~/lib/utils';

import { useCharacterAssistant } from '../context/character-assistant-context.hooks';
import { useCharacterCreatorContext } from '../context/character-creator-context/character-creator-context.hooks';
import { getCharacterLibraryItemDisplayName } from '../lib/character-library';
import { MAX_EXAMPLE_CHARACTER_COUNT } from '../lib/example-characters';
import { SettingsDialog } from './settings-dialog';
import { SETTINGS_DIALOG_TABS } from './settings-dialog-tabs';
import type { SettingsDialogTab } from './settings-dialog-tabs';
import { TokenStats } from './token-stats';

export interface iCharacterCreatorHeaderProps {
  isCharacterLibraryPanelOpen: boolean;
  onCharacterLibraryPanelToggle: () => void;
}

export function CharacterCreatorHeader({
  isCharacterLibraryPanelOpen,
  onCharacterLibraryPanelToggle,
}: iCharacterCreatorHeaderProps) {
  const {
    data,
    isCharacterLibraryReady,
    characterLibrary,
    activeCharacterId,
    generationSettings,
    selectedRequestModeLabel,
    maxExampleContextCharacters,
    exampleCharacters,
    openImportDialog,
    openExportDialog,
  } = useCharacterCreatorContext();
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsDialogTab>(SETTINGS_DIALOG_TABS.connection);
  const { openAssistant } = useCharacterAssistant();
  const activeCharacter =
    characterLibrary.find((character) => character.id === activeCharacterId) ?? characterLibrary[0];

  const resolveActiveCharacterLabel = () => {
    if (!isCharacterLibraryReady) {
      return 'Loading library...';
    }

    return activeCharacter ? getCharacterLibraryItemDisplayName(activeCharacter) : 'Untitled character';
  };

  const activeCharacterLabel = resolveActiveCharacterLabel();

  const openSettingsDialog = (tab: SettingsDialogTab) => {
    setActiveSettingsTab(tab);
    setIsSettingsDialogOpen(true);
  };

  return (
    <header className="sticky top-0 z-20 border-b bg-background/92 backdrop-blur-sm">
      <div className="mx-auto flex max-w-384 flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm">
            C
          </div>
          <div className="space-y-0.5">
            <p className="text-sm font-semibold">Character Card Creator</p>
            <p className="text-xs text-muted-foreground">
              {activeCharacterLabel} | {selectedRequestModeLabel} | {generationSettings.model || 'Model not set'}
            </p>
            <p className="text-xs text-muted-foreground">
              Context budget: {maxExampleContextCharacters.toLocaleString()} chars
            </p>
            <TokenStats data={data} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-controls="character-library-panel"
            aria-expanded={isCharacterLibraryPanelOpen}
            aria-label={isCharacterLibraryPanelOpen ? 'Hide character library' : 'Show character library'}
            onClick={onCharacterLibraryPanelToggle}
          >
            <LuChevronRight
              className={cn('size-4 transition-transform', isCharacterLibraryPanelOpen ? 'rotate-180' : null)}
            />
            Library
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => openSettingsDialog(SETTINGS_DIALOG_TABS.examples)}
          >
            Reference Examples {exampleCharacters.length}/{MAX_EXAMPLE_CHARACTER_COUNT}
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => openSettingsDialog(SETTINGS_DIALOG_TABS.connection)}
          >
            <LuSettings className="size-4" />
            Settings
          </Button>

          <Button type="button" size="sm" variant="outline" onClick={openAssistant}>
            <LuSparkles className="size-4" />
            Assistant
          </Button>

          <div className="hidden h-5 w-px bg-border sm:block" />

          <Button type="button" size="sm" variant="outline" onClick={openImportDialog}>
            <LuFileUp className="size-4" />
            Import
          </Button>
          <Button type="button" size="sm" onClick={openExportDialog}>
            <LuDownload className="size-4" />
            Export
          </Button>
        </div>
      </div>

      <SettingsDialog
        isOpen={isSettingsDialogOpen}
        activeTab={activeSettingsTab}
        onOpenChange={setIsSettingsDialogOpen}
        onTabChange={setActiveSettingsTab}
      />
    </header>
  );
}
