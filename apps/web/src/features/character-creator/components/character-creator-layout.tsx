import { parseAsStringEnum, useQueryState } from 'nuqs';
import { useCallback, useEffect, useRef, useState } from 'react';

import { cn } from '@~/lib/utils';

import { CharacterAssistantProvider } from '../context/character-assistant-context';
import { useCharacterAssistant } from '../context/character-assistant-context.hooks';
import { useWorkspacePanelLayout } from '../hooks/use-workspace-panel-layout';
import { CharacterAssistantPanel } from './character-assistant-panel';
import { CharacterCreatorHeader } from './character-creator-header';
import { CharacterLibraryPanel } from './character-library-panel';
import { CharacterSectionPanel } from './character-section-panel';
import { CharacterSwitcher } from './character-switcher';
import { PageDialogs } from './page-dialogs';
import { PortraitPanel } from './portrait-panel';
import { SettingsDialog } from './settings-dialog';
import { SETTINGS_DIALOG_TABS } from './settings-dialog-tabs';
import type { SettingsDialogTab } from './settings-dialog-tabs';
import { CharacterCreatorTabs } from './tabs/character-creator-tabs';
import { CHARACTER_CREATOR_TABS } from './tabs/tabs.constants';
import type { CharacterCreatorTab } from './tabs/tabs.constants';

const ASSISTANT_COLUMN_MEDIA_QUERY = '(min-width: 1280px)';

function CharacterCreatorWorkspace() {
  const [isCharacterLibraryPanelOpen, setIsCharacterLibraryPanelOpen] = useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsDialogTab>(SETTINGS_DIALOG_TABS.connection);
  const [activeCharacterTab, setActiveCharacterTab] = useQueryState(
    'tab',
    parseAsStringEnum<CharacterCreatorTab>(Object.values(CHARACTER_CREATOR_TABS)).withDefault(
      CHARACTER_CREATOR_TABS.core,
    ),
  );
  const [isAssistantColumnViewport, setIsAssistantColumnViewport] = useState(false);
  const assistantToggleRef = useRef<HTMLButtonElement>(null);
  const { isAssistantOpen } = useCharacterAssistant();
  const {
    assistantPanelWidth,
    isSectionPanelCollapsed,
    sectionPanelWidth,
    setAssistantPanelWidth,
    setIsSectionPanelCollapsed,
    setSectionPanelWidth,
  } = useWorkspacePanelLayout();

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
    setIsCharacterLibraryPanelOpen(!isCharacterLibraryPanelOpen);
  }, [isCharacterLibraryPanelOpen]);

  const closeCharacterLibraryPanel = useCallback(() => {
    setIsCharacterLibraryPanelOpen(false);
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
  const isCharacterLibraryPanelVisible = isCharacterLibraryPanelOpen;
  const isWorkspaceDense = isCharacterLibraryPanelVisible && isAssistantColumnOpen;

  return (
    <>
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(234,88,12,0.10),transparent_32%),linear-gradient(to_bottom,rgba(245,245,244,0.65),transparent_30%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.10),transparent_32%),linear-gradient(to_bottom,rgba(38,38,38,0.35),transparent_30%)]">
        <div className="shrink-0" inert={isAssistantOverlay ? true : undefined}>
          <CharacterCreatorHeader
            assistantToggleRef={assistantToggleRef}
            isCharacterLibraryPanelOpen={isCharacterLibraryPanelVisible}
            onCharacterLibraryPanelToggle={toggleCharacterLibraryPanel}
            onSettingsOpen={openSettingsDialog}
          />
          <CharacterSwitcher />
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden" inert={isAssistantOverlay ? true : undefined}>
          <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
            {isCharacterLibraryPanelVisible ? (
              <button
                type="button"
                aria-label="Close character library"
                className="fixed inset-0 z-30 bg-background/75 backdrop-blur-sm lg:hidden"
                onClick={closeCharacterLibraryPanel}
              />
            ) : null}

            <CharacterLibraryPanel isOpen={isCharacterLibraryPanelVisible} onClose={closeCharacterLibraryPanel} />

            <CharacterSectionPanel
              activeTab={activeCharacterTab}
              isCollapsed={isSectionPanelCollapsed || isWorkspaceDense}
              isCollapseLocked={isWorkspaceDense}
              width={sectionPanelWidth}
              onActiveTabChange={setActiveCharacterTab}
              onCollapsedChange={setIsSectionPanelCollapsed}
              onWidthChange={setSectionPanelWidth}
            />

            <main className="min-w-0 flex-1 overflow-y-auto overscroll-contain">
              <div
                className={cn(
                  'mx-auto grid max-w-320 gap-5 p-4 xl:p-6',
                  isWorkspaceDense ? 'grid-cols-1' : 'lg:grid-cols-[minmax(180px,220px)_minmax(0,1fr)]',
                )}
              >
                <div className={cn(isWorkspaceDense ? 'hidden' : null)}>
                  <PortraitPanel />
                </div>
                <CharacterCreatorTabs activeTab={activeCharacterTab} onActiveTabChange={setActiveCharacterTab} />
              </div>
              <PageDialogs />
            </main>
          </div>

          {isAssistantColumnOpen ? (
            <CharacterAssistantPanel
              width={assistantPanelWidth}
              onWidthChange={setAssistantPanelWidth}
              onRestoreAssistantToggleFocus={restoreAssistantToggleFocus}
              isOverlay={false}
              onOpenConnectionSettings={openConnectionSettings}
            />
          ) : null}
        </div>

        {isAssistantOverlay ? (
          <CharacterAssistantPanel
            width={assistantPanelWidth}
            onWidthChange={setAssistantPanelWidth}
            onRestoreAssistantToggleFocus={restoreAssistantToggleFocus}
            isOverlay
            onOpenConnectionSettings={openConnectionSettings}
          />
        ) : null}
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
