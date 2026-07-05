import { Avatar } from '@~/components/ui/avatar';

import {
  getPortraitCropRect,
  getSillyTavernAvatarCropRect,
  SILLY_TAVERN_PORTRAIT_ASPECT_RATIO,
} from '../lib/portrait-focal-point';
import type { iPortraitCropRect, iPortraitDimensions } from '../lib/portrait-focal-point';
import { PortraitPreviewSurface } from './portrait-preview-surface';

export interface iPortraitAvatarPreviewProps {
  cropRect: iPortraitCropRect;
  portraitDimensions: iPortraitDimensions;
  portraitUrl: string;
}

export function PortraitAvatarPreview({ cropRect, portraitDimensions, portraitUrl }: iPortraitAvatarPreviewProps) {
  const portraitCropRect = getPortraitCropRect(portraitDimensions, cropRect);
  const avatarCropRect = getSillyTavernAvatarCropRect(portraitDimensions, cropRect);

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-medium">SillyTavern preview</p>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border bg-card/60 p-4">
          <PortraitPreviewSurface
            alt="Exported portrait preview"
            className="mx-auto mt-3 w-full max-w-45 rounded-xl border bg-background"
            cropRect={portraitCropRect}
            portraitDimensions={portraitDimensions}
            portraitUrl={portraitUrl}
            style={{ aspectRatio: SILLY_TAVERN_PORTRAIT_ASPECT_RATIO }}
          />
        </div>

        <div className="flex flex-col gap-2 rounded-xl border bg-card/60 p-4">
          <div className="flex items-start gap-3 rounded-xl border bg-background/90 p-3">
            <Avatar className="size-12.5 shrink-0 border border-border/80 shadow-sm">
              <PortraitPreviewSurface
                alt="Chat avatar preview"
                className="size-full rounded-full"
                cropRect={avatarCropRect}
                portraitDimensions={portraitDimensions}
                portraitUrl={portraitUrl}
              />
            </Avatar>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="truncate text-sm font-semibold">Character Name</p>
              <div className="space-y-2 rounded-2xl border bg-card/60 p-3">
                <div className="h-2 w-full rounded-full bg-muted-foreground/20" />
                <div className="h-2 w-[82%] rounded-full bg-muted-foreground/20" />
                <div className="h-2 w-[64%] rounded-full bg-muted-foreground/20" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-dashed bg-muted/10 p-3">
            <PortraitPreviewSurface
              alt="Portrait list tile preview"
              className="w-11 shrink-0 rounded-lg border bg-background"
              cropRect={portraitCropRect}
              portraitDimensions={portraitDimensions}
              portraitUrl={portraitUrl}
              style={{ aspectRatio: SILLY_TAVERN_PORTRAIT_ASPECT_RATIO }}
            />
            <p className="text-sm text-muted-foreground">
              The same portrait crop is embedded into the exported PNG card.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
