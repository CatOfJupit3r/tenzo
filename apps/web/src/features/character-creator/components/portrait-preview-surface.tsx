import type { CSSProperties } from 'react';

import { cn } from '@~/lib/utils';

import type { iPortraitCropRect, iPortraitDimensions } from '../lib/portrait-focal-point';

export interface iPortraitPreviewSurfaceProps {
  alt: string;
  className?: string;
  cropRect: iPortraitCropRect;
  imageClassName?: string;
  portraitDimensions: iPortraitDimensions;
  portraitUrl: string;
  style?: CSSProperties;
}

export function PortraitPreviewSurface({
  alt,
  className,
  cropRect,
  imageClassName,
  portraitDimensions,
  portraitUrl,
  style,
}: iPortraitPreviewSurfaceProps) {
  return (
    <div className={cn('relative block overflow-hidden', className)} style={style}>
      <img
        alt={alt}
        className={cn('absolute max-w-none object-none select-none', imageClassName)}
        draggable={false}
        src={portraitUrl}
        style={{
          width: `${(portraitDimensions.width / cropRect.width) * 100}%`,
          height: `${(portraitDimensions.height / cropRect.height) * 100}%`,
          left: `${(-cropRect.x / cropRect.width) * 100}%`,
          top: `${(-cropRect.y / cropRect.height) * 100}%`,
        }}
      />
    </div>
  );
}
