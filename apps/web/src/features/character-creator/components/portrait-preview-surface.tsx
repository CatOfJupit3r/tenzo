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
      <svg
        aria-label={alt}
        className="block size-full select-none"
        role="img"
        viewBox={`${cropRect.x} ${cropRect.y} ${cropRect.width} ${cropRect.height}`}
      >
        <title>{alt}</title>
        <image
          className={cn('pointer-events-none', imageClassName)}
          height={portraitDimensions.height}
          href={portraitUrl}
          preserveAspectRatio="none"
          width={portraitDimensions.width}
        />
      </svg>
    </div>
  );
}
