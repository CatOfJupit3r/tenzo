import type { ChangeEvent } from 'react';
import { LuImagePlus, LuTrash2 } from 'react-icons/lu';

import { Button } from '@~/components/ui/button';
import { CardDescription, CardHeader, CardTitle } from '@~/components/ui/card';

export interface iImageUploadProps {
  portraitUrl: string | null;
  portraitFileName: string | null;
  isHydratingPortrait: boolean;
  onSelectFile: (file: File) => Promise<unknown>;
  onClear: () => Promise<unknown>;
}

export function ImageUpload({
  portraitUrl,
  portraitFileName,
  isHydratingPortrait,
  onSelectFile,
  onClear,
}: iImageUploadProps) {
  return (
    <div className="space-y-4">
      <CardHeader className="px-0">
        <CardTitle>Portrait</CardTitle>
        <CardDescription>Upload PNG, JPG, or WebP. Non-PNG images are converted before PNG export.</CardDescription>
      </CardHeader>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
        <label className="flex min-h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center transition-colors hover:border-foreground/40 hover:bg-muted/50">
          <input
            className="sr-only"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={async (event: ChangeEvent<HTMLInputElement>) => {
              const selectedFile = event.target.files?.[0];
              if (!selectedFile) {
                return;
              }

              try {
                await onSelectFile(selectedFile);
              } finally {
                event.target.value = '';
              }
            }}
          />
          <LuImagePlus className="size-5" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Choose portrait image</p>
            <p className="text-sm text-muted-foreground">The portrait stays local and is reused during PNG export.</p>
          </div>
        </label>

        <div className="flex min-h-48 flex-col overflow-hidden rounded-xl border bg-background">
          {portraitUrl ? (
            <img alt="Character portrait preview" className="size-full min-h-48 object-cover" src={portraitUrl} />
          ) : (
            <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-muted-foreground">
              {isHydratingPortrait ? 'Loading saved portrait...' : 'No portrait selected yet.'}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">{portraitFileName ?? 'No portrait file stored.'}</p>
        <Button disabled={!portraitUrl} type="button" variant="outline" onClick={async () => onClear()}>
          <LuTrash2 className="size-4" />
          Clear portrait
        </Button>
      </div>
    </div>
  );
}
