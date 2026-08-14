import { del, get, set } from 'idb-keyval';

const CHARACTER_ASSET_KEY_PREFIX = 'tenzo:character-creator:asset:';

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
