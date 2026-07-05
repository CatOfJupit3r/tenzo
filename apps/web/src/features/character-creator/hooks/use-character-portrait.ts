import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { iCharacterPortraitReference } from '../lib/character-library';
import { deleteCharacterAssetBlob, readCharacterAssetBlob, writeCharacterAssetBlob } from '../lib/image-store';
import {
  arePortraitCropRectsEqual,
  getPortraitCropRect,
  readPortraitDimensions,
  sanitizeStoredPortraitCropRect,
} from '../lib/portrait-focal-point';
import type { iPortraitCropRect, iPortraitDimensions } from '../lib/portrait-focal-point';
import { useCharacterSession } from './use-character-session';

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

export function useCharacterPortrait() {
  const { portraitReference: storedPortraitReference, setActiveCharacterPortrait } = useCharacterSession();
  const [portraitBlob, setPortraitBlob] = useState<Blob | null>(null);
  const [portraitObjectUrl, setPortraitObjectUrl] = useState<string | null>(null);
  const [portraitDimensions, setPortraitDimensions] = useState<iPortraitDimensions | null>(null);
  const [isHydratingPortrait, setIsHydratingPortrait] = useState(false);
  const loadedPortraitAssetIdRef = useRef<string | null>(null);
  const portraitReference = useMemo(
    () => sanitizePortraitReference(storedPortraitReference),
    [storedPortraitReference],
  );
  const portraitAssetId = portraitReference?.assetId ?? null;

  useEffect(() => {
    if (!storedPortraitReference || portraitReference === storedPortraitReference) {
      return;
    }

    setActiveCharacterPortrait(portraitReference);
  }, [portraitReference, setActiveCharacterPortrait, storedPortraitReference]);

  useEffect(() => {
    let isCancelled = false;

    if (!portraitAssetId) {
      loadedPortraitAssetIdRef.current = null;
      setPortraitBlob(null);
      setPortraitDimensions(null);
      setIsHydratingPortrait(false);
      return undefined;
    }

    if (loadedPortraitAssetIdRef.current === portraitAssetId && portraitBlob) {
      setIsHydratingPortrait(false);
      return undefined;
    }

    setIsHydratingPortrait(true);

    readCharacterAssetBlob(portraitAssetId)
      .then((blob) => {
        if (isCancelled) {
          return;
        }

        if (!blob) {
          loadedPortraitAssetIdRef.current = null;
          setActiveCharacterPortrait(null);
          setPortraitBlob(null);
          setPortraitDimensions(null);
          return;
        }

        loadedPortraitAssetIdRef.current = portraitAssetId;
        setPortraitBlob(blob);
      })
      .catch(() => {
        if (isCancelled) {
          return;
        }

        loadedPortraitAssetIdRef.current = null;
        setActiveCharacterPortrait(null);
        setPortraitBlob(null);
        setPortraitDimensions(null);
      })
      .finally(() => {
        if (!isCancelled) {
          setIsHydratingPortrait(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [portraitAssetId, portraitBlob, setActiveCharacterPortrait]);

  useEffect(() => {
    if (!portraitBlob) {
      setPortraitObjectUrl(null);
      return undefined;
    }

    const nextObjectUrl = URL.createObjectURL(portraitBlob);
    setPortraitObjectUrl(nextObjectUrl);

    return () => {
      URL.revokeObjectURL(nextObjectUrl);
    };
  }, [portraitBlob]);

  useEffect(() => {
    let isCancelled = false;

    if (!portraitBlob) {
      setPortraitDimensions(null);
      return undefined;
    }

    readPortraitDimensions(portraitBlob)
      .then((dimensions) => {
        if (!isCancelled) {
          setPortraitDimensions(dimensions);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setPortraitDimensions(null);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [portraitBlob]);

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

  const setPortrait = useCallback(
    async (blob: Blob, fileName: string, cropRect: iPortraitCropRect | null = null) => {
      const dimensions = await readPortraitDimensions(blob);
      const assetId = crypto.randomUUID();
      const nextCropRect = getPortraitCropRect(dimensions, cropRect);

      await writeCharacterAssetBlob(assetId, blob);

      if (portraitReference) {
        await deleteCharacterAssetBlob(portraitReference.assetId);
      }

      setActiveCharacterPortrait({
        assetId,
        fileName,
        mimeType: blob.type || 'application/octet-stream',
        cropRect: nextCropRect,
      });
      loadedPortraitAssetIdRef.current = assetId;
      setPortraitBlob(blob);
      setPortraitDimensions(dimensions);
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
    }

    setActiveCharacterPortrait(null);
    loadedPortraitAssetIdRef.current = null;
    setPortraitBlob(null);
    setPortraitDimensions(null);
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
