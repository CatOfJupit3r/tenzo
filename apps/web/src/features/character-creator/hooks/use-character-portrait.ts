import { useCallback, useEffect, useMemo, useRef } from 'react';

import { generateUuid } from '@~/utils/uuid';

import type { iCharacterPortraitReference } from '../lib/character-library';
import { deleteCharacterAssetBlob, writeCharacterAssetBlob } from '../lib/image-store';
import { invalidatePortraitAsset, PORTRAIT_ASSET_STATUSES, primePortraitAsset } from '../lib/portrait-asset-cache';
import {
  arePortraitCropRectsEqual,
  getPortraitCropRect,
  readPortraitDimensions,
  renderPortraitThumbnailDataUrl,
  sanitizeStoredPortraitCropRect,
} from '../lib/portrait-focal-point';
import type { iPortraitCropRect } from '../lib/portrait-focal-point';
import { useCharacterSession } from './use-character-session';
import { isPortraitAssetHydrating, usePortraitAsset } from './use-portrait-asset';

const THUMBNAIL_REGENERATION_DELAY_MS = 200;

function sanitizePortraitReference(
  portraitReference: iCharacterPortraitReference | null,
): iCharacterPortraitReference | null {
  if (!portraitReference) {
    return null;
  }

  const cropRect = sanitizeStoredPortraitCropRect(portraitReference.cropRect);
  if (arePortraitCropRectsEqual(cropRect, portraitReference.cropRect)) {
    return portraitReference;
  }

  return {
    ...portraitReference,
    cropRect,
  };
}

function serializeCropRect(cropRect: iPortraitCropRect | null) {
  if (!cropRect) {
    return 'default';
  }

  return `${cropRect.x}:${cropRect.y}:${cropRect.width}:${cropRect.height}`;
}

export function useCharacterPortrait() {
  const { portraitReference: storedPortraitReference, setActiveCharacterPortrait } = useCharacterSession();
  const portraitReference = useMemo(
    () => sanitizePortraitReference(storedPortraitReference),
    [storedPortraitReference],
  );
  const portraitAssetId = portraitReference?.assetId ?? null;
  const portraitAsset = usePortraitAsset(portraitAssetId);
  const portraitBlob = portraitAsset.blob;
  const portraitObjectUrl = portraitAsset.objectUrl;
  const portraitDimensions = portraitAsset.dimensions;
  const isHydratingPortrait = Boolean(portraitAssetId) && isPortraitAssetHydrating(portraitAsset);
  const lastThumbnailSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (!storedPortraitReference || portraitReference === storedPortraitReference) {
      return;
    }

    setActiveCharacterPortrait(portraitReference);
  }, [portraitReference, setActiveCharacterPortrait, storedPortraitReference]);

  useEffect(() => {
    // A referenced asset that cannot be read is stale; drop the dangling reference.
    if (portraitReference && portraitAsset.status === PORTRAIT_ASSET_STATUSES.error) {
      setActiveCharacterPortrait(null);
    }
  }, [portraitAsset.status, portraitReference, setActiveCharacterPortrait]);

  const portraitCropRect = useMemo(() => {
    if (!portraitDimensions) {
      return null;
    }

    return getPortraitCropRect(portraitDimensions, portraitReference?.cropRect);
  }, [portraitDimensions, portraitReference?.cropRect]);

  useEffect(() => {
    if (
      !portraitReference ||
      !portraitCropRect ||
      arePortraitCropRectsEqual(portraitReference.cropRect, portraitCropRect)
    ) {
      return;
    }

    setActiveCharacterPortrait({
      ...portraitReference,
      cropRect: portraitCropRect,
    });
  }, [portraitCropRect, portraitReference, setActiveCharacterPortrait]);

  useEffect(() => {
    // Trust the persisted thumbnail across character switches; only regenerate when
    // the crop changes within this session (or when no thumbnail exists yet).
    lastThumbnailSignatureRef.current = null;
  }, [portraitAssetId]);

  useEffect(() => {
    if (!portraitReference || !portraitBlob || !portraitCropRect) {
      return undefined;
    }

    const signature = `${portraitReference.assetId}:${serializeCropRect(portraitCropRect)}`;
    if (lastThumbnailSignatureRef.current === signature) {
      return undefined;
    }

    if (lastThumbnailSignatureRef.current === null && portraitReference.thumbnailDataUrl) {
      lastThumbnailSignatureRef.current = signature;
      return undefined;
    }

    let isCancelled = false;
    const timeoutId = window.setTimeout(() => {
      void renderPortraitThumbnailDataUrl(portraitBlob, portraitCropRect).then((thumbnailDataUrl) => {
        if (isCancelled) {
          return;
        }

        lastThumbnailSignatureRef.current = signature;
        setActiveCharacterPortrait({
          ...portraitReference,
          thumbnailDataUrl,
        });
      });
    }, THUMBNAIL_REGENERATION_DELAY_MS);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [portraitBlob, portraitCropRect, portraitReference, setActiveCharacterPortrait]);

  const setPortrait = useCallback(
    async (blob: Blob, fileName: string, cropRect: iPortraitCropRect | null = null) => {
      const dimensions = await readPortraitDimensions(blob);
      const assetId = generateUuid();
      const nextCropRect = getPortraitCropRect(dimensions, cropRect);
      const thumbnailDataUrl = await renderPortraitThumbnailDataUrl(blob, nextCropRect);

      await writeCharacterAssetBlob(assetId, blob);

      if (portraitReference) {
        await deleteCharacterAssetBlob(portraitReference.assetId);
        invalidatePortraitAsset(portraitReference.assetId);
      }

      primePortraitAsset(assetId, blob, dimensions);
      lastThumbnailSignatureRef.current = `${assetId}:${serializeCropRect(nextCropRect)}`;
      setActiveCharacterPortrait({
        assetId,
        fileName,
        mimeType: blob.type || 'application/octet-stream',
        cropRect: nextCropRect,
        thumbnailDataUrl,
      });
    },
    [portraitReference, setActiveCharacterPortrait],
  );

  const updatePortraitCropRect = useCallback(
    (cropRect: iPortraitCropRect) => {
      if (!portraitReference || !portraitDimensions) {
        return;
      }

      const nextCropRect = getPortraitCropRect(portraitDimensions, cropRect);
      if (arePortraitCropRectsEqual(portraitReference.cropRect, nextCropRect)) {
        return;
      }

      setActiveCharacterPortrait({
        ...portraitReference,
        cropRect: nextCropRect,
      });
    },
    [portraitDimensions, portraitReference, setActiveCharacterPortrait],
  );

  const clearPortrait = useCallback(async () => {
    if (portraitReference) {
      await deleteCharacterAssetBlob(portraitReference.assetId);
      invalidatePortraitAsset(portraitReference.assetId);
    }

    lastThumbnailSignatureRef.current = null;
    setActiveCharacterPortrait(null);
  }, [portraitReference, setActiveCharacterPortrait]);

  return {
    portraitReference,
    portraitBlob,
    portraitDimensions,
    portraitObjectUrl,
    isHydratingPortrait,
    portraitCropRect,
    setPortrait,
    updatePortraitCropRect,
    clearPortrait,
  };
}
