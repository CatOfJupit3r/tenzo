import type { ChangeEvent, ReactNode } from 'react';
import { useCallback, useId, useState } from 'react';
import { LuFocus, LuImagePlus, LuRefreshCw, LuTrash2 } from 'react-icons/lu';

import { Button } from '@~/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@~/components/ui/dialog';

import { SILLY_TAVERN_PORTRAIT_ASPECT_RATIO } from '../lib/portrait-focal-point';
import type { iPortraitCropRect, iPortraitDimensions } from '../lib/portrait-focal-point';
import { PortraitAvatarPreview } from './portrait-avatar-preview';
import { PortraitFocalPointEditor } from './portrait-focal-point-editor';
import { PortraitPreviewSurface } from './portrait-preview-surface';

export interface iImageUploadProps {
  portraitUrl: string | null;
  portraitFileName: string | null;
  portraitDimensions: iPortraitDimensions | null;
  portraitCropRect: iPortraitCropRect | null;
  isHydratingPortrait: boolean;
  onSelectFile: (file: File) => Promise<unknown>;
  onCropRectChange: (cropRect: iPortraitCropRect) => void;
  onClear: () => Promise<unknown>;
}

export function ImageUpload({
  portraitUrl,
  portraitFileName,
  portraitDimensions,
  portraitCropRect,
  isHydratingPortrait,
  onSelectFile,
  onCropRectChange,
  onClear,
}: iImageUploadProps) {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const portraitFileInputId = useId();
  const isPortraitLoading = isHydratingPortrait || (portraitUrl !== null && portraitDimensions === null);
  const isPortraitReady = portraitUrl !== null && portraitDimensions !== null && portraitCropRect !== null;

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const selectedFile = event.target.files?.[0];
      if (!selectedFile) {
        return;
      }

      try {
        await onSelectFile(selectedFile);
      } finally {
        event.target.value = '';
      }
    },
    [onSelectFile],
  );

  const handleClear = useCallback(async () => {
    await onClear();
  }, [onClear]);

  let portraitContent: ReactNode;

  if (isPortraitLoading) {
    portraitContent = (
      <div className="flex aspect-2/3 w-full items-center justify-center rounded-[20px] border bg-muted/20 px-4 text-center text-sm text-muted-foreground">
        Loading saved portrait...
      </div>
    );
  } else if (isPortraitReady) {
    portraitContent = (
      <div className="space-y-4">
        <div className="group relative overflow-hidden rounded-[20px] border bg-black/95 shadow-sm">
          <PortraitPreviewSurface
            alt={portraitFileName ?? 'Selected portrait preview'}
            className="w-full"
            cropRect={portraitCropRect}
            portraitDimensions={portraitDimensions}
            portraitUrl={portraitUrl}
            style={{ aspectRatio: SILLY_TAVERN_PORTRAIT_ASPECT_RATIO }}
          />
          <div className="absolute inset-0 flex w-full items-center justify-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
            <Button type="button" variant="outline" onClick={() => setIsEditorOpen(true)}>
              <LuFocus className="size-4" />
            </Button>
            <Button variant="outline">
              <LuRefreshCw className="size-4" />
            </Button>
            <Button type="button" variant="destructive" onClick={handleClear}>
              <LuTrash2 className="size-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
              <DialogHeader>
                <DialogTitle>Portrait & previews</DialogTitle>
                <DialogDescription>
                  Drag to choose which part stays centered in the exported crop, then confirm how it reads in portrait
                  and avatar surfaces.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:items-start">
                <PortraitFocalPointEditor
                  cropRect={portraitCropRect}
                  onCropRectChange={onCropRectChange}
                  portraitDimensions={portraitDimensions}
                  portraitUrl={portraitUrl}
                />
                <PortraitAvatarPreview
                  cropRect={portraitCropRect}
                  portraitDimensions={portraitDimensions}
                  portraitUrl={portraitUrl}
                />
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    );
  } else {
    portraitContent = (
      <label
        htmlFor={portraitFileInputId}
        className="flex aspect-2/3 w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-[20px] border border-dashed border-border bg-muted/30 p-6 text-center transition-colors hover:border-foreground/40 hover:bg-muted/50"
      >
        <LuImagePlus className="size-5" />
        <div className="space-y-1">
          <p className="text-sm font-medium">Drop portrait here</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            The portrait stays local. You can zoom, pan, and export the final crop directly into the PNG card.
          </p>
        </div>
      </label>
    );
  }

  return (
    <div className="space-y-4">
      <input
        id={portraitFileInputId}
        className="sr-only"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileChange}
      />
      {portraitContent}
    </div>
  );
}
