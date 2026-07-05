import { z } from 'zod';

import { readCharacterAssetBlob } from './image-store';
import { readPortraitDimensions } from './portrait-focal-point';
import type { iPortraitDimensions } from './portrait-focal-point';

export const PORTRAIT_ASSET_STATUS_SCHEMA = z.enum(['loading', 'loaded', 'error']);
export const PORTRAIT_ASSET_STATUSES = PORTRAIT_ASSET_STATUS_SCHEMA.enum;
export type PortraitAssetStatus = z.infer<typeof PORTRAIT_ASSET_STATUS_SCHEMA>;

export interface iPortraitAssetEntry {
  status: PortraitAssetStatus;
  blob: Blob | null;
  objectUrl: string | null;
  dimensions: iPortraitDimensions | null;
  error: Error | null;
}

const MAX_RETAINED_ASSETS = 24;
const isBrowser = typeof window !== 'undefined';

/**
 * Shared, persistent cache of decoded portrait assets keyed by `assetId`. Object
 * URLs are created once and retained across character switches (bounded LRU), so a
 * previously viewed portrait renders synchronously with no reload flicker. Blobs
 * live in IndexedDB; this layer is the reactive, in-memory view over them.
 */
export const MISSING_PORTRAIT_ASSET_ENTRY: iPortraitAssetEntry = Object.freeze({
  status: PORTRAIT_ASSET_STATUSES.loading,
  blob: null,
  objectUrl: null,
  dimensions: null,
  error: null,
});

/** Stable snapshot returned when there is no asset to load at all. */
export const EMPTY_PORTRAIT_ASSET_ENTRY: iPortraitAssetEntry = Object.freeze({
  status: PORTRAIT_ASSET_STATUSES.loaded,
  blob: null,
  objectUrl: null,
  dimensions: null,
  error: null,
});

const store = new Map<string, iPortraitAssetEntry>();
const inFlightLoads = new Map<string, Promise<iPortraitAssetEntry>>();
const listeners = new Set<() => unknown>();

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

function revokeObjectUrl(objectUrl: string | null) {
  if (objectUrl && isBrowser) {
    URL.revokeObjectURL(objectUrl);
  }
}

function evictOverflow() {
  while (store.size > MAX_RETAINED_ASSETS) {
    const oldestAssetId = store.keys().next().value;

    if (oldestAssetId === undefined) {
      return;
    }

    if (inFlightLoads.has(oldestAssetId)) {
      // Do not evict an asset that is mid-load; retry eviction on the next write.
      return;
    }

    revokeObjectUrl(store.get(oldestAssetId)?.objectUrl ?? null);
    store.delete(oldestAssetId);
  }
}

function setEntry(assetId: string, entry: iPortraitAssetEntry) {
  // Re-insert to move the asset to the most-recently-used position.
  store.delete(assetId);
  store.set(assetId, entry);
  evictOverflow();
}

export function subscribeToPortraitAssets(listener: () => unknown) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function getPortraitAssetSnapshot(assetId: string): iPortraitAssetEntry {
  return store.get(assetId) ?? MISSING_PORTRAIT_ASSET_ENTRY;
}

export async function ensurePortraitAssetLoaded(assetId: string): Promise<iPortraitAssetEntry> {
  const existingEntry = store.get(assetId);

  if (existingEntry?.status === PORTRAIT_ASSET_STATUSES.loaded) {
    setEntry(assetId, existingEntry);
    return Promise.resolve(existingEntry);
  }

  const inFlightLoad = inFlightLoads.get(assetId);

  if (inFlightLoad) {
    return inFlightLoad;
  }

  if (!existingEntry) {
    setEntry(assetId, MISSING_PORTRAIT_ASSET_ENTRY);
    notify();
  }

  const load = (async (): Promise<iPortraitAssetEntry> => {
    try {
      const blob = await readCharacterAssetBlob(assetId);

      if (!blob) {
        const missingEntry: iPortraitAssetEntry = {
          status: PORTRAIT_ASSET_STATUSES.error,
          blob: null,
          objectUrl: null,
          dimensions: null,
          error: new Error('Portrait asset is missing.'),
        };
        setEntry(assetId, missingEntry);
        return missingEntry;
      }

      const dimensions = await readPortraitDimensions(blob);
      const loadedEntry: iPortraitAssetEntry = {
        status: PORTRAIT_ASSET_STATUSES.loaded,
        blob,
        objectUrl: isBrowser ? URL.createObjectURL(blob) : null,
        dimensions,
        error: null,
      };
      setEntry(assetId, loadedEntry);
      return loadedEntry;
    } catch (error) {
      const failedEntry: iPortraitAssetEntry = {
        status: PORTRAIT_ASSET_STATUSES.error,
        blob: null,
        objectUrl: null,
        dimensions: null,
        error: error instanceof Error ? error : new Error('Failed to load portrait asset.'),
      };
      setEntry(assetId, failedEntry);
      return failedEntry;
    } finally {
      inFlightLoads.delete(assetId);
      notify();
    }
  })();

  inFlightLoads.set(assetId, load);
  return load;
}

/**
 * Seeds the cache with an already-decoded blob (e.g. right after the user picks a
 * portrait) so the editor renders it immediately without an IndexedDB round-trip.
 */
export function primePortraitAsset(assetId: string, blob: Blob, dimensions: iPortraitDimensions): iPortraitAssetEntry {
  revokeObjectUrl(store.get(assetId)?.objectUrl ?? null);

  const primedEntry: iPortraitAssetEntry = {
    status: PORTRAIT_ASSET_STATUSES.loaded,
    blob,
    objectUrl: isBrowser ? URL.createObjectURL(blob) : null,
    dimensions,
    error: null,
  };
  setEntry(assetId, primedEntry);
  notify();

  return primedEntry;
}

export function invalidatePortraitAsset(assetId: string) {
  const existingEntry = store.get(assetId);

  if (!existingEntry && !inFlightLoads.has(assetId)) {
    return;
  }

  revokeObjectUrl(existingEntry?.objectUrl ?? null);
  store.delete(assetId);
  inFlightLoads.delete(assetId);
  notify();
}
