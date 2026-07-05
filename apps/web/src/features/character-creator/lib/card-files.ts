import { getCharacterCardFileStem, parseCharacterCardJson, serializeCharacterCard } from './card-format';
import type { CharacterCard } from './card-schema';
import { convertImageBlobToPng, downloadBlob, readBlobAsUint8Array, readFileAsText } from './image-utils';
import { embedCharacterCardInPng, readCharacterCardFromPng } from './png-embed';

export interface iImportedCharacterCardFile {
  card: CharacterCard;
  portraitBlob: Blob | null;
  fileName: string;
  sourceKind: 'json' | 'png';
}

function isJsonFile(file: File): boolean {
  return file.type === 'application/json' || file.name.toLowerCase().endsWith('.json');
}

function isPngFile(file: File): boolean {
  return file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
}

export async function importCharacterCardFile(file: File): Promise<iImportedCharacterCardFile> {
  if (isJsonFile(file)) {
    const jsonText = await readFileAsText(file);
    return {
      card: parseCharacterCardJson(jsonText),
      portraitBlob: null,
      fileName: file.name,
      sourceKind: 'json',
    };
  }

  if (isPngFile(file)) {
    const pngBytes = await readBlobAsUint8Array(file);
    const jsonText = readCharacterCardFromPng(pngBytes);

    return {
      card: parseCharacterCardJson(jsonText),
      portraitBlob: file,
      fileName: file.name,
      sourceKind: 'png',
    };
  }

  throw new Error('Unsupported import file. Use a JSON or PNG character card.');
}

export async function exportCharacterCardJson(card: CharacterCard) {
  const jsonText = serializeCharacterCard(card);
  const jsonBlob = new Blob([jsonText], { type: 'application/json' });
  downloadBlob(jsonBlob, `${getCharacterCardFileStem(card)}.json`);
}

export async function exportCharacterCardPng(card: CharacterCard, portraitBlob: Blob) {
  const basePngBlob = await convertImageBlobToPng(portraitBlob);
  const pngBytes = await readBlobAsUint8Array(basePngBlob);
  const characterJson = serializeCharacterCard(card);
  const embeddedPngBytes = embedCharacterCardInPng(pngBytes, characterJson);
  const embeddedPngBlob = new Blob([embeddedPngBytes.slice()], { type: 'image/png' });

  downloadBlob(embeddedPngBlob, `${getCharacterCardFileStem(card)}.png`);
}
