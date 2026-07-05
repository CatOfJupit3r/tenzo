import { CharacterCreatorHeader } from './character-creator-header';
import { PageDialogs } from './page-dialogs';
import { PortraitPanel } from './portrait-panel';
import { CharacterCreatorTabs } from './tabs/character-creator-tabs';

export function CharacterCreatorLayout() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(234,88,12,0.10),transparent_32%),linear-gradient(to_bottom,rgba(245,245,244,0.65),transparent_30%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.10),transparent_32%),linear-gradient(to_bottom,rgba(38,38,38,0.35),transparent_30%)]">
      <CharacterCreatorHeader />

      <div className="mx-auto max-w-7xl px-4 pt-2 pb-16 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)]">
          <PortraitPanel />
          <CharacterCreatorTabs />
        </div>
      </div>

      <PageDialogs />
    </div>
  );
}
