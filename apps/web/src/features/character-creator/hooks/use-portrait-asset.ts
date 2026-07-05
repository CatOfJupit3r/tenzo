import { useCallback, useEffect, useSyncExternalStore } from 'react';

import {
  EMPTY_PORTRAIT_ASSET_ENTRY,
  ensurePortraitAssetLoaded,
  getPortraitAssetSnapshot,
  PORTRAIT_ASSET_STATUSES,
  subscribeToPortraitAssets,
} from '../lib/portrait-asset-cache';
import type { iPortraitAssetEntry } from '../lib/portrait-asset-cache';

/**
 * Subscribes to the shared portrait asset cache for a single asset. Returns the
 * cached entry synchronously when available (no flicker on character switch) and
 * triggers a background load otherwise.
 */
export function usePortraitAsset(assetId: string | null): iPortraitAssetEntry {
  const getSnapshot = useCallback(
    () => (assetId ? getPortraitAssetSnapshot(assetId) : EMPTY_PORTRAIT_ASSET_ENTRY),
    [assetId],
  );

  const entry = useSyncExternalStore(subscribeToPortraitAssets, getSnapshot, getSnapshot);

  useEffect(() => {
    if (!assetId) {
      return;
    }

    void ensurePortraitAssetLoaded(assetId);
  }, [assetId]);

  return entry;
}

export function isPortraitAssetHydrating(entry: iPortraitAssetEntry) {
  return entry.status === PORTRAIT_ASSET_STATUSES.loading;
}
