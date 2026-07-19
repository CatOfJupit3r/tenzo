import { useCallback, useEffect, useRef, useState } from 'react';

import { CharacterAssistantProvider } from '../context/character-assistant-context';
import { useCharacterAssistant } from '../context/character-assistant-context.hooks';
import { CharacterAssistantPanel } from './character-assistant-panel';
import { CharacterCreatorHeader } from './character-creator-header';
import { CharacterLibraryPanel } from './character-library-panel';
import { PageDialogs } from './page-dialogs';
import { PortraitPanel } from './portrait-panel';
import { SettingsDialog } from './settings-dialog';
import { SETTINGS_DIALOG_TABS } from './settings-dialog-tabs';
import type { SettingsDialogTab } from './settings-dialog-tabs';
import { CharacterCreatorTabs } from './tabs/character-creator-tabs';

const ASSISTANT_COLUMN_MEDIA_QUERY = '(min-width: 1280px)';

function CharacterCreatorWorkspace() {
  const [isCharacterLibraryPanelOpen, setIsCharacterLibraryPanelOpen] = useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsDialogTab>(SETTINGS_DIALOG_TABS.connection);
  const [isAssistantColumnViewport, setIsAssistantColumnViewport] = useState(false);
  const assistantToggleRef = useRef<HTMLButtonElement>(null);
  const { isAssistantOpen, closeAssistant } = useCharacterAssistant();

  useEffect(() => {
    const mediaQuery = window.matchMedia(ASSISTANT_COLUMN_MEDIA_QUERY);
    const updateAssistantViewportMode = () => {
      setIsAssistantColumnViewport(mediaQuery.matches);
    };

    updateAssistantViewportMode();
    mediaQuery.addEventListener('change', updateAssistantViewportMode);

    return () => {
      mediaQuery.removeEventListener('change', updateAssistantViewportMode);
    };
  }, []);

  const toggleCharacterLibraryPanel = useCallback(() => {
    if (!isCharacterLibraryPanelOpen && isAssistantOpen && isAssistantColumnViewport) {
      closeAssistant();
    }

    setIsCharacterLibraryPanelOpen(!isCharacterLibraryPanelOpen);
  }, [closeAssistant, isAssistantColumnViewport, isAssistantOpen, isCharacterLibraryPanelOpen]);

  const closeCharacterLibraryPanel = useCallback(() => {
    setIsCharacterLibraryPanelOpen(false);
  }, []);

  const openCharacterLibraryPanel = useCallback(() => {
    setIsCharacterLibraryPanelOpen(true);
  }, []);

  const openSettingsDialog = useCallback((tab: SettingsDialogTab) => {
    setActiveSettingsTab(tab);
    setIsSettingsDialogOpen(true);
  }, []);

  const openConnectionSettings = useCallback(() => {
    openSettingsDialog(SETTINGS_DIALOG_TABS.connection);
  }, [openSettingsDialog]);

  const restoreAssistantToggleFocus = useCallback(() => {
    assistantToggleRef.current?.focus();
  }, []);

  const isAssistantColumnOpen = isAssistantOpen && isAssistantColumnViewport;
  const isAssistantOverlay = isAssistantOpen && !isAssistantColumnViewport;
  const isCharacterLibraryPanelVisible = isCharacterLibraryPanelOpen && !isAssistantColumnOpen;
  let editorGridClassName =
    'grid gap-4 lg:grid-cols-[minmax(160px,190px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(180px,220px)_minmax(0,1fr)]';

  if (isAssistantColumnOpen) {
    editorGridClassName =
      'grid gap-4 lg:grid-cols-[112px_minmax(0,1fr)] min-[1400px]:grid-cols-[minmax(128px,140px)_minmax(0,1fr)] min-[1536px]:grid-cols-[minmax(180px,220px)_minmax(0,1fr)]';
  }

  useEffect(() => {
    if (isAssistantOpen && isAssistantColumnViewport && isCharacterLibraryPanelOpen) {
      setIsCharacterLibraryPanelOpen(false);
    }
  }, [isAssistantColumnViewport, isAssistantOpen, isCharacterLibraryPanelOpen]);

  return (
    <>
      <div className="relative flex h-full min-h-0 overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(234,88,12,0.10),transparent_32%),linear-gradient(to_bottom,rgba(245,245,244,0.65),transparent_30%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.10),transparent_32%),linear-gradient(to_bottom,rgba(38,38,38,0.35),transparent_30%)]">
        <div
          className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain"
          inert={isAssistantOverlay ? true : undefined}
        >
          <CharacterCreatorHeader
            assistantToggleRef={assistantToggleRef}
            isCharacterLibraryPanelOpen={isCharacterLibraryPanelVisible}
            onCharacterLibraryPanelToggle={toggleCharacterLibraryPanel}
            onSettingsOpen={openSettingsDialog}
          />

          <div className="mx-auto flex max-w-384 gap-0 px-4 pt-2 pb-16 sm:px-6 lg:gap-6 lg:px-8">
            {isCharacterLibraryPanelVisible ? (
              <button
                type="button"
                aria-label="Close character library"
                className="fixed inset-0 z-30 bg-background/75 backdrop-blur-sm lg:hidden"
                onClick={closeCharacterLibraryPanel}
              />
            ) : null}

            <CharacterLibraryPanel
              isOpen={isCharacterLibraryPanelVisible}
              onClose={closeCharacterLibraryPanel}
              onGuidedStartFailure={openCharacterLibraryPanel}
            />

            <main className="min-w-0 flex-1">
              <div className={editorGridClassName}>
                <PortraitPanel />
                <CharacterCreatorTabs />
              </div>
            </main>
          </div>

          <PageDialogs />
        </div>

        <CharacterAssistantPanel
          onRestoreAssistantToggleFocus={restoreAssistantToggleFocus}
          isOverlay={isAssistantOverlay}
          onOpenConnectionSettings={openConnectionSettings}
        />
      </div>

      <SettingsDialog
        isOpen={isSettingsDialogOpen}
        activeTab={activeSettingsTab}
        onOpenChange={setIsSettingsDialogOpen}
        onTabChange={setActiveSettingsTab}
      />
    </>
  );
}

export function CharacterCreatorLayout() {
  return (
    <CharacterAssistantProvider>
      <CharacterCreatorWorkspace />
    </CharacterAssistantProvider>
  );
}
