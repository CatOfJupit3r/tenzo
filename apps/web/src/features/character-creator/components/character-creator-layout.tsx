import { useCallback, useState } from 'react';

import { CharacterAssistantProvider } from '../context/character-assistant-context';
import { CharacterAssistantDrawer } from './character-assistant-drawer';
import { CharacterCreatorHeader } from './character-creator-header';
import { CharacterLibraryPanel } from './character-library-panel';
import { PageDialogs } from './page-dialogs';
import { PortraitPanel } from './portrait-panel';
import { CharacterCreatorTabs } from './tabs/character-creator-tabs';

export function CharacterCreatorLayout() {
  const [isCharacterLibraryPanelOpen, setIsCharacterLibraryPanelOpen] = useState(true);

  const toggleCharacterLibraryPanel = useCallback(() => {
    setIsCharacterLibraryPanelOpen((isOpen) => !isOpen);
  }, []);

  const closeCharacterLibraryPanel = useCallback(() => {
    setIsCharacterLibraryPanelOpen(false);
  }, []);

  return (
    <CharacterAssistantProvider>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(234,88,12,0.10),transparent_32%),linear-gradient(to_bottom,rgba(245,245,244,0.65),transparent_30%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.10),transparent_32%),linear-gradient(to_bottom,rgba(38,38,38,0.35),transparent_30%)]">
        <CharacterCreatorHeader
          isCharacterLibraryPanelOpen={isCharacterLibraryPanelOpen}
          onCharacterLibraryPanelToggle={toggleCharacterLibraryPanel}
        />

        <div className="mx-auto flex max-w-384 gap-0 px-4 pt-2 pb-16 sm:px-6 lg:gap-6 lg:px-8">
          {isCharacterLibraryPanelOpen ? (
            <button
              type="button"
              aria-label="Close character library"
              className="fixed inset-0 z-30 bg-background/75 backdrop-blur-sm lg:hidden"
              onClick={closeCharacterLibraryPanel}
            />
          ) : null}

          <CharacterLibraryPanel isOpen={isCharacterLibraryPanelOpen} onClose={closeCharacterLibraryPanel} />

          <main className="min-w-0 flex-1">
            <div className="grid gap-6 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] xl:grid-cols-[minmax(300px,360px)_minmax(0,1fr)]">
              <PortraitPanel />
              <CharacterCreatorTabs />
            </div>
          </main>
        </div>

        <PageDialogs />
        <CharacterAssistantDrawer />
      </div>
    </CharacterAssistantProvider>
  );
}
