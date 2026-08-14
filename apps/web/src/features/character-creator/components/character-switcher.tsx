import { useAtomValue } from 'jotai';
import { LuImage, LuPlus } from 'react-icons/lu';

import { Button } from '@~/components/ui/button/button';
import { cn } from '@~/lib/utils';

import { activeCharacterIdAtom } from '../atoms/character-session.atom';
import { useCharacterCreatorActions } from '../context/character-creator-context/character-creator-actions-context.hooks';
import { useCharacterLibraryList } from '../hooks/use-character-library-list';
import { getCharacterLibraryItemDisplayName } from '../lib/character-library';

export function CharacterSwitcher() {
  const { characterLibrary, isCharacterLibraryReady } = useCharacterLibraryList();
  const activeCharacterId = useAtomValue(activeCharacterIdAtom);
  const { handleCreateCharacter, handleSelectCharacter } = useCharacterCreatorActions();

  return (
    <nav aria-label="Characters" className="border-b bg-background/75 px-3 py-2 backdrop-blur-sm">
      <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-0.5">
        {!isCharacterLibraryReady && characterLibrary.length === 0 ? (
          <div className="h-14 w-40 shrink-0 animate-pulse rounded-lg bg-muted/40" aria-hidden="true" />
        ) : null}
        {characterLibrary.map((character) => {
          const displayName = getCharacterLibraryItemDisplayName(character);
          const isActiveCharacter = character.id === activeCharacterId;

          return (
            <button
              key={character.id}
              type="button"
              aria-current={isActiveCharacter ? 'true' : undefined}
              className={cn(
                'flex h-14 min-w-40 shrink-0 items-center gap-2 rounded-lg border px-2.5 text-left transition-colors',
                'hover:bg-muted/30 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                isActiveCharacter ? 'border-primary/60 bg-primary/5' : 'border-transparent bg-muted/15',
              )}
              onClick={() => handleSelectCharacter(character.id)}
            >
              <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/30">
                {character.portrait?.thumbnailDataUrl ? (
                  <img src={character.portrait.thumbnailDataUrl} alt="" className="size-full object-cover" />
                ) : (
                  <LuImage className="size-4 text-muted-foreground" />
                )}
              </span>
              <span className="min-w-0 truncate text-sm font-medium">{displayName}</span>
            </button>
          );
        })}
        <Button
          type="button"
          variant="ghost"
          className="h-14 min-w-40 shrink-0 justify-start border border-dashed"
          onClick={handleCreateCharacter}
        >
          <span className="flex size-9 items-center justify-center rounded-md border border-dashed">
            <LuPlus className="size-4" />
          </span>
          New character
        </Button>
      </div>
    </nav>
  );
}
