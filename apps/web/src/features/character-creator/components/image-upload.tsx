import type { ChangeEvent, ReactNode } from 'react';
import { useCallback, useId } from 'react';
import { LuImagePlus, LuRefreshCw, LuTrash2 } from 'react-icons/lu';

import { Button } from '@~/components/ui/button';
import { CardDescription, CardHeader, CardTitle } from '@~/components/ui/card';

import type { iPortraitCropRect, iPortraitDimensions } from '../lib/portrait-focal-point';
import { PortraitAvatarPreview } from './portrait-avatar-preview';
import { PortraitFocalPointEditor } from './portrait-focal-point-editor';

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
      <div className="flex min-h-96 items-center justify-center rounded-xl border bg-muted/20 px-4 text-center text-sm text-muted-foreground">
        Loading saved portrait...
      </div>
    );
  } else if (isPortraitReady) {
    portraitContent = (
      <div className="space-y-3">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,460px)_minmax(0,1fr)] xl:items-start">
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

        <p className="text-sm text-muted-foreground">{portraitFileName ?? 'Portrait image selected.'}</p>
      </div>
    );
  } else {
    portraitContent = (
      <label
        htmlFor={portraitFileInputId}
        className="flex min-h-96 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center transition-colors hover:border-foreground/40 hover:bg-muted/50"
      >
        <LuImagePlus className="size-5" />
        <div className="space-y-1">
          <p className="text-sm font-medium">Choose portrait image</p>
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

      <CardHeader className="px-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle>Portrait</CardTitle>
            <CardDescription>
              Upload PNG, JPG, or WebP. Drag to reframe the 2:3 export crop, then preview how the avatar will look in
              chat and character lists.
            </CardDescription>
          </div>

          {isPortraitReady ? (
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <label htmlFor={portraitFileInputId}>
                  <LuRefreshCw className="size-4" />
                  Replace portrait
                </label>
              </Button>
              <Button type="button" variant="outline" onClick={handleClear}>
                <LuTrash2 className="size-4" />
                Clear portrait
              </Button>
            </div>
          ) : null}
        </div>
      </CardHeader>

      {portraitContent}
    </div>
  );
}
