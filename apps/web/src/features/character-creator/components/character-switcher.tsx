import { LuImage, LuPlus, LuTrash2 } from 'react-icons/lu';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@~/components/ui/alert-dialog';
import { Button } from '@~/components/ui/button/button';
import { cn } from '@~/lib/utils';

import { useCharacterCreatorActions } from '../context/character-creator-context/character-creator-actions-context.hooks';
import { useCharacterCreatorContext } from '../context/character-creator-context/character-creator-context.hooks';
import { useCharacterLibraryList } from '../hooks/use-character-library-list';
import { getCharacterLibraryItemDisplayName } from '../lib/cards/character-library';
import type { iCharacterLibraryItem } from '../lib/cards/character-library';

export interface iCharacterSwitcherViewProps {
  characterLibrary: readonly iCharacterLibraryItem[];
  activeCharacterId: string;
  isCharacterLibraryReady: boolean;
  onCreateCharacter: () => unknown;
  onRemoveCharacter: (id: string) => Promise<unknown>;
  onSelectCharacter: (id: string) => unknown;
}

export function CharacterSwitcherView({
  characterLibrary,
  activeCharacterId,
  isCharacterLibraryReady,
  onCreateCharacter,
  onRemoveCharacter,
  onSelectCharacter,
}: iCharacterSwitcherViewProps) {
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
            <div
              key={character.id}
              className={cn(
                'flex h-14 min-w-40 shrink-0 items-center gap-2 rounded-lg border px-2.5 text-left transition-colors',
                'hover:bg-muted/30',
                isActiveCharacter ? 'border-primary/60 bg-primary/5' : 'border-transparent bg-muted/15',
              )}
            >
              <button
                type="button"
                aria-current={isActiveCharacter ? 'true' : undefined}
                className="flex min-w-0 flex-1 items-center gap-2 self-stretch rounded-md text-left focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                onClick={() => onSelectCharacter(character.id)}
              >
                <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/30">
                  {character.portrait?.thumbnailDataUrl ? (
                    <img src={character.portrait.thumbnailDataUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <LuImage className="size-4 text-muted-foreground" />
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{displayName}</span>
              </button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label={`Delete ${displayName}`}
                    title="Delete"
                  >
                    <LuTrash2 className="size-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete {displayName}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently deletes the character, portrait, and assistant conversation stored in this
                      browser.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async () => {
                        await onRemoveCharacter(character.id);
                      }}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          );
        })}
        <Button
          type="button"
          variant="ghost"
          className="h-14 min-w-40 shrink-0 justify-start border border-dashed"
          onClick={onCreateCharacter}
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

export function CharacterSwitcher() {
  const { characterLibrary, isCharacterLibraryReady } = useCharacterLibraryList();
  const { activeCharacterId } = useCharacterCreatorContext();
  const { handleCreateCharacter, handleRemoveCharacter, handleSelectCharacter } = useCharacterCreatorActions();

  return (
    <CharacterSwitcherView
      characterLibrary={characterLibrary}
      activeCharacterId={activeCharacterId}
      isCharacterLibraryReady={isCharacterLibraryReady}
      onCreateCharacter={handleCreateCharacter}
      onRemoveCharacter={handleRemoveCharacter}
      onSelectCharacter={handleSelectCharacter}
    />
  );
}
