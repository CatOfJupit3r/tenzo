import { del, get, keys, set } from 'idb-keyval';

const CHARACTER_ASSET_KEY_PREFIX = 'tenzo:character-creator:asset:';
const GUIDED_REFERENCE_ASSET_PREFIX = 'guided-ref:';

function getCharacterAssetKey(assetId: string): string {
  return `${CHARACTER_ASSET_KEY_PREFIX}${assetId}`;
}

export async function readCharacterAssetBlob(assetId: string): Promise<Blob | null> {
  return (await get<Blob>(getCharacterAssetKey(assetId))) ?? null;
}

export async function writeCharacterAssetBlob(assetId: string, blob: Blob) {
  await set(getCharacterAssetKey(assetId), blob);
}

export async function deleteCharacterAssetBlob(assetId: string) {
  await del(getCharacterAssetKey(assetId));
}

export async function deleteGuidedReferenceAssetBlobs(characterId: string) {
  if (typeof indexedDB === 'undefined') {
    return;
  }

  const assetPrefix = `${CHARACTER_ASSET_KEY_PREFIX}${GUIDED_REFERENCE_ASSET_PREFIX}${characterId}:`;
  const assetKeys = await keys();
  await Promise.all(
    assetKeys
      .filter((assetKey): assetKey is string => typeof assetKey === 'string' && assetKey.startsWith(assetPrefix))
      .map(async (assetKey) => del(assetKey)),
  );
}
