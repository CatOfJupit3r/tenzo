import { useCallback, useEffect, useMemo, useState } from 'react';
import { LuCopy, LuFolderOpen, LuImage, LuPlus, LuTrash2, LuUserPen, LuX } from 'react-icons/lu';

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
import { Badge } from '@~/components/ui/badge';
import { Button } from '@~/components/ui/button';
import { cn } from '@~/lib/utils';

import { useCharacterCreatorContext } from '../context/character-creator-context/character-creator-context.hooks';
import type { iCharacterLibraryItem } from '../lib/character-library';
import { getCharacterLibraryItemDisplayName, getCharacterLibraryItemSummary } from '../lib/character-library';
import { readCharacterAssetBlob } from '../lib/image-store';
import {
  getPortraitCropRect,
  readPortraitDimensions,
  SILLY_TAVERN_PORTRAIT_ASPECT_RATIO,
} from '../lib/portrait-focal-point';
import type { iPortraitCropRect, iPortraitDimensions } from '../lib/portrait-focal-point';
import { PortraitPreviewSurface } from './portrait-preview-surface';

interface iCharacterLibraryPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface iCharacterLibraryItemProps {
  character: iCharacterLibraryItem;
  preview: iCharacterLibraryPreview | null;
  isActiveCharacter: boolean;
  onSelect: (id: string) => void;
  onDuplicate: (id: string) => Promise<unknown>;
  onRemove: (id: string) => Promise<unknown>;
}

interface iCharacterLibraryPreview {
  cropRect: iPortraitCropRect | null;
  portraitDimensions: iPortraitDimensions | null;
  previewUrl: string | null;
}

function useCharacterLibraryPreviewUrls() {
  const { characterLibrary } = useCharacterCreatorContext();
  const [previewUrls, setPreviewUrls] = useState<Record<string, iCharacterLibraryPreview>>({});

  useEffect(() => {
    let isCancelled = false;
    const createdUrls: string[] = [];

    Promise.all(
      characterLibrary.map(async (character) => {
        if (!character.portrait) {
          return [
            character.id,
            {
              cropRect: null,
              portraitDimensions: null,
              previewUrl: null,
            },
          ] as const;
        }

        const blob = await readCharacterAssetBlob(character.portrait.assetId);

        if (!blob) {
          return [
            character.id,
            {
              cropRect: null,
              portraitDimensions: null,
              previewUrl: null,
            },
          ] as const;
        }

        const portraitDimensions = await readPortraitDimensions(blob);
        const objectUrl = URL.createObjectURL(blob);
        createdUrls.push(objectUrl);
        return [
          character.id,
          {
            cropRect: getPortraitCropRect(portraitDimensions, character.portrait.cropRect),
            portraitDimensions,
            previewUrl: objectUrl,
          },
        ] as const;
      }),
    )
      .then((entries) => {
        if (isCancelled) {
          createdUrls.forEach((url) => URL.revokeObjectURL(url));
          return;
        }

        setPreviewUrls(Object.fromEntries(entries));
      })
      .catch(() => {
        if (!isCancelled) {
          setPreviewUrls({});
        }
      });

    return () => {
      isCancelled = true;
      createdUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [characterLibrary]);

  return previewUrls;
}

function CharacterLibraryItem({
  character,
  preview,
  isActiveCharacter,
  onSelect,
  onDuplicate,
  onRemove,
}: iCharacterLibraryItemProps) {
  const displayName = getCharacterLibraryItemDisplayName(character);
  const hasCreator = character.card.data.creator.trim() !== '';
  const hasTags = character.card.data.tags.length > 0;
  const hasAlternateGreetings = character.card.data.alternate_greetings.length > 0;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border transition-colors',
        isActiveCharacter ? 'border-primary/60 bg-primary/5 shadow-sm' : 'bg-muted/10 hover:bg-muted/20',
      )}
    >
      <button
        className="grid w-full grid-cols-[4.5rem_minmax(0,1fr)] gap-3 p-3 text-left focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        type="button"
        aria-current={isActiveCharacter ? 'true' : undefined}
        onClick={() => onSelect(character.id)}
      >
        <div className="flex h-24 w-18 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/30">
          {preview?.previewUrl && preview.cropRect && preview.portraitDimensions ? (
            <PortraitPreviewSurface
              alt={`${displayName} portrait preview`}
              className="size-full"
              cropRect={preview.cropRect}
              portraitDimensions={preview.portraitDimensions}
              portraitUrl={preview.previewUrl}
              style={{ aspectRatio: SILLY_TAVERN_PORTRAIT_ASPECT_RATIO }}
            />
          ) : (
            <LuImage className="size-5 text-muted-foreground" />
          )}
        </div>

        <div className="min-w-0 space-y-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p className="min-w-0 truncate text-sm font-semibold">{displayName}</p>
            {isActiveCharacter ? <Badge>Editing</Badge> : null}
          </div>

          <p className="line-clamp-2 text-sm text-muted-foreground">{getCharacterLibraryItemSummary(character)}</p>

          <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {hasCreator ? (
              <span className="inline-flex min-w-0 items-center gap-1">
                <LuUserPen className="size-3.5 shrink-0" />
                <span className="truncate">{character.card.data.creator.trim()}</span>
              </span>
            ) : null}
            {hasTags ? <span>{character.card.data.tags.length} tags</span> : null}
            {hasAlternateGreetings ? <span>{character.card.data.alternate_greetings.length} greetings</span> : null}
          </div>
        </div>
      </button>

      <div className="flex justify-end gap-1 border-t px-2 py-1.5">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label={`Duplicate ${displayName}`}
          title="Duplicate"
          onClick={async () => {
            await onDuplicate(character.id);
          }}
        >
          <LuCopy className="size-4" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" size="icon" variant="ghost" aria-label={`Remove ${displayName}`} title="Remove">
              <LuTrash2 className="size-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove character?</AlertDialogTitle>
              <AlertDialogDescription>
                This clears the saved character entry and its local portrait asset from this browser.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  await onRemove(character.id);
                }}
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

export function CharacterLibraryPanel({ isOpen, onClose }: iCharacterLibraryPanelProps) {
  const {
    characterLibrary,
    activeCharacterId,
    handleCreateCharacter,
    handleSelectCharacter,
    handleDuplicateCharacter,
    handleRemoveCharacter,
    openImportDialog,
  } = useCharacterCreatorContext();
  const previewUrls = useCharacterLibraryPreviewUrls();

  const characterCountLabel = useMemo(() => {
    if (characterLibrary.length === 1) {
      return '1 character saved locally';
    }

    return `${characterLibrary.length} characters saved locally`;
  }, [characterLibrary.length]);

  const handleSelectCharacterFromPanel = useCallback(
    (id: string) => {
      handleSelectCharacter(id);

      const isSmallViewport = globalThis.matchMedia?.('(max-width: 1023px)').matches ?? false;

      if (isSmallViewport) {
        onClose();
      }
    },
    [handleSelectCharacter, onClose],
  );

  return (
    <aside
      id="character-library-panel"
      aria-label="Character library"
      aria-hidden={!isOpen}
      inert={isOpen ? undefined : true}
      className={cn(
        'left-0 z-40 flex w-[min(24rem,calc(100vw-1rem))] flex-col border-r bg-background shadow-xl transition-transform duration-300 ease-out max-lg:fixed max-lg:inset-y-0 sm:w-96 lg:sticky lg:z-10 lg:h-[calc(100vh-7rem)] lg:w-80 lg:shrink-0 lg:rounded-xl lg:border lg:bg-card/95 lg:shadow-sm xl:w-88',
        isOpen ? 'translate-x-0' : '-translate-x-full lg:hidden',
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="space-y-4 border-b p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-base font-semibold">Library</h2>
                <Badge variant="outline">{characterLibrary.length}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{characterCountLabel}</p>
            </div>

            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="lg:hidden"
              aria-label="Close character library"
              onClick={onClose}
            >
              <LuX className="size-4" />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button type="button" size="sm" onClick={handleCreateCharacter}>
              <LuPlus className="size-4" />
              New
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={openImportDialog}>
              <LuFolderOpen className="size-4" />
              Import
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="space-y-2">
            {characterLibrary.map((character) => (
              <CharacterLibraryItem
                key={character.id}
                character={character}
                preview={previewUrls[character.id] ?? null}
                isActiveCharacter={character.id === activeCharacterId}
                onSelect={handleSelectCharacterFromPanel}
                onDuplicate={handleDuplicateCharacter}
                onRemove={handleRemoveCharacter}
              />
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
