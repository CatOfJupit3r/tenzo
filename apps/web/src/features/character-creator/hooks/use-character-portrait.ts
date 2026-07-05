import { useAtom } from 'jotai';
import { useCallback, useEffect, useState } from 'react';

import { characterPortraitAtom } from '../atoms/character-session.atom';
import { deleteCharacterAssetBlob, readCharacterAssetBlob, writeCharacterAssetBlob } from '../lib/image-store';

export function useCharacterPortrait() {
  const [portraitReference, setPortraitReference] = useAtom(characterPortraitAtom);
  const [portraitBlob, setPortraitBlob] = useState<Blob | null>(null);
  const [portraitObjectUrl, setPortraitObjectUrl] = useState<string | null>(null);
  const [isHydratingPortrait, setIsHydratingPortrait] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    if (!portraitReference) {
      setPortraitBlob(null);
      setIsHydratingPortrait(false);
      return undefined;
    }

    setIsHydratingPortrait(true);

    readCharacterAssetBlob(portraitReference.assetId)
      .then((blob) => {
        if (isCancelled) {
          return;
        }

        if (!blob) {
          setPortraitReference(null);
          setPortraitBlob(null);
          return;
        }

        setPortraitBlob(blob);
      })
      .catch(() => {
        if (isCancelled) {
          return;
        }

        setPortraitReference(null);
        setPortraitBlob(null);
      })
      .finally(() => {
        if (!isCancelled) {
          setIsHydratingPortrait(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [portraitReference, setPortraitReference]);

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

  const setPortrait = useCallback(
    async (blob: Blob, fileName: string) => {
      const assetId = crypto.randomUUID();

      await writeCharacterAssetBlob(assetId, blob);

      if (portraitReference) {
        await deleteCharacterAssetBlob(portraitReference.assetId);
      }

      setPortraitReference({
        assetId,
        fileName,
        mimeType: blob.type || 'application/octet-stream',
      });
      setPortraitBlob(blob);
    },
    [portraitReference, setPortraitReference],
  );

  const clearPortrait = useCallback(async () => {
    if (portraitReference) {
      await deleteCharacterAssetBlob(portraitReference.assetId);
    }

    setPortraitReference(null);
    setPortraitBlob(null);
  }, [portraitReference, setPortraitReference]);

  return {
    portraitReference,
    portraitBlob,
    portraitObjectUrl,
    isHydratingPortrait,
    setPortrait,
    clearPortrait,
  };
}
