import type { Ref } from 'react';
import {
  LuChevronRight,
  LuCircleAlert,
  LuCircleCheck,
  LuDownload,
  LuFileUp,
  LuLoaderCircle,
  LuSave,
  LuSettings,
  LuSparkles,
} from 'react-icons/lu';

import { Button } from '@~/components/ui/button/button';
import { Popover, PopoverContent, PopoverTrigger } from '@~/components/ui/popover';
import { cn } from '@~/lib/utils';

import { useCharacterAssistant } from '../context/character-assistant-context.hooks';
import { useCharacterCreatorContext } from '../context/character-creator-context/character-creator-context.hooks';
import { getCharacterLibraryItemDisplayName } from '../lib/cards/character-library';
import { MAX_EXAMPLE_CHARACTER_COUNT } from '../lib/cards/example-characters';
import { SETTINGS_DIALOG_TABS } from './settings-dialog-tabs';
import type { SettingsDialogTab } from './settings-dialog-tabs';
import { TokenStats } from './token-stats';

export interface iCharacterCreatorHeaderProps {
  assistantToggleRef: Ref<HTMLButtonElement>;
  isCharacterLibraryPanelOpen: boolean;
  onCharacterLibraryPanelToggle: () => void;
  onSettingsOpen: (tab: SettingsDialogTab) => void;
}

export function CharacterCreatorHeader({
  assistantToggleRef,
  isCharacterLibraryPanelOpen,
  onCharacterLibraryPanelToggle,
  onSettingsOpen,
}: iCharacterCreatorHeaderProps) {
  const {
    data,
    isCharacterLibraryReady,
    isSaving,
    saveErrorMessage,
    hasPersistedEdits,
    lastSavedAt,
    characterLibrary,
    activeCharacterId,
    generationSettings,
    apiKey,
    connectionHealth,
    selectedRequestModeLabel,
    maxExampleContextCharacters,
    exampleCharacters,
    openImportDialog,
    openExportDialog,
  } = useCharacterCreatorContext();
  const { isAssistantOpen, openAssistant, closeAssistant } = useCharacterAssistant();
  const activeCharacter =
    characterLibrary.find((character) => character.id === activeCharacterId) ?? characterLibrary[0];

  const resolveActiveCharacterLabel = () => {
    if (!isCharacterLibraryReady) {
      return 'Loading library...';
    }

    return activeCharacter ? getCharacterLibraryItemDisplayName(activeCharacter) : 'Untitled character';
  };

  const activeCharacterLabel = resolveActiveCharacterLabel();
  const isConnectionConfigured = Boolean(
    generationSettings.endpoint.trim() && generationSettings.model.trim() && apiKey.trim(),
  );
  let connectionStatusLabel = 'AI setup needed';
  let ConnectionStatusIcon = LuCircleAlert;
  let isConnectionStatusIconSpinning = false;

  if (connectionHealth.isChecking) {
    connectionStatusLabel = 'Checking connection';
    ConnectionStatusIcon = LuLoaderCircle;
    isConnectionStatusIconSpinning = true;
  } else if (connectionHealth.errorMessage) {
    connectionStatusLabel = 'Connection issue';
  } else if (isConnectionConfigured) {
    connectionStatusLabel = 'AI configured';
    ConnectionStatusIcon = LuCircleCheck;
  }

  let saveStatusLabel = 'Local autosave';

  if (isSaving) {
    saveStatusLabel = 'Saving...';
  } else if (saveErrorMessage) {
    saveStatusLabel = 'Save failed';
  } else if (hasPersistedEdits) {
    saveStatusLabel = 'Saved locally';
  }

  let saveStatusTitle = 'Changes are saved to this browser automatically.';

  if (saveErrorMessage) {
    saveStatusTitle = saveErrorMessage;
  } else if (lastSavedAt) {
    saveStatusTitle = `Last saved locally at ${lastSavedAt.toLocaleTimeString()}`;
  }

  const endpointLabel = generationSettings.endpoint.trim() ? generationSettings.endpoint : 'Not set';
  const modelLabel = generationSettings.model.trim() ? generationSettings.model : 'Not set';

  return (
    <header className="sticky top-0 z-20 border-b bg-background/92 backdrop-blur-sm">
      <div className="mx-auto flex max-w-384 flex-col gap-2 px-4 py-2 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-sm">
            C
          </div>
          <div className="min-w-0 space-y-0.5">
            <div className="flex min-w-0 items-baseline gap-2">
              <p className="shrink-0 text-lg font-semibold">Tenzo</p>
              <p className="max-w-56 truncate text-xs text-muted-foreground" title={activeCharacterLabel}>
                {activeCharacterLabel}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span
                role="status"
                aria-live="polite"
                className={cn(
                  'inline-flex items-center gap-1',
                  saveErrorMessage ? 'text-destructive' : null,
                  hasPersistedEdits && !isSaving && !saveErrorMessage ? 'text-emerald-700 dark:text-emerald-300' : null,
                )}
                title={saveStatusTitle}
              >
                {isSaving ? <LuLoaderCircle className="size-3 animate-spin" /> : <LuSave className="size-3" />}
                {saveStatusLabel}
              </span>
              <span aria-hidden="true">|</span>
              <TokenStats data={data} />
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className={cn(
                      'h-6 gap-1 px-1.5 text-xs',
                      connectionHealth.errorMessage || !isConnectionConfigured
                        ? 'text-amber-700 dark:text-amber-300'
                        : null,
                    )}
                    aria-label={`${connectionStatusLabel}. Show connection details`}
                  >
                    <ConnectionStatusIcon
                      className={cn('size-3', isConnectionStatusIconSpinning ? 'animate-spin' : null)}
                    />
                    {connectionStatusLabel}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-88 space-y-3 text-xs">
                  <div>
                    <p className="font-medium text-foreground">AI connection</p>
                    <p className="text-muted-foreground">Generation settings saved in this browser.</p>
                  </div>
                  <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-muted-foreground">
                    <dt>Endpoint</dt>
                    <dd className="break-all text-foreground">{endpointLabel}</dd>
                    <dt>Model</dt>
                    <dd className="break-all text-foreground">{modelLabel}</dd>
                    <dt>Request</dt>
                    <dd className="text-foreground">{selectedRequestModeLabel}</dd>
                    <dt>API key</dt>
                    <dd className="text-foreground">{apiKey.trim() ? 'Configured' : 'Missing'}</dd>
                    <dt>Provider</dt>
                    <dd className="text-foreground">{connectionHealth.providerName ?? 'Not detected'}</dd>
                    <dt>Context</dt>
                    <dd className="text-foreground">{maxExampleContextCharacters.toLocaleString()} chars</dd>
                  </dl>
                  {connectionHealth.errorMessage ? (
                    <p role="alert" className="text-destructive">
                      {connectionHealth.errorMessage}
                    </p>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => onSettingsOpen(SETTINGS_DIALOG_TABS.connection)}
                  >
                    <LuSettings className="size-4" />
                    Open connection settings
                  </Button>
                </PopoverContent>
              </Popover>
            </div>
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
            onClick={() => onSettingsOpen(SETTINGS_DIALOG_TABS.examples)}
          >
            Reference Examples {exampleCharacters.length}/{MAX_EXAMPLE_CHARACTER_COUNT}
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onSettingsOpen(SETTINGS_DIALOG_TABS.connection)}
          >
            <LuSettings className="size-4" />
            Settings
          </Button>

          <Button
            ref={assistantToggleRef}
            type="button"
            size="sm"
            variant={isAssistantOpen ? 'secondary' : 'outline'}
            aria-pressed={isAssistantOpen}
            onClick={isAssistantOpen ? closeAssistant : openAssistant}
          >
            <LuSparkles className="size-4" />
            {isAssistantOpen ? 'Hide Assistant' : 'Show Assistant'}
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
    </header>
  );
}
