import { generateUuid } from '@~/utils/uuid';

import { appendGuidedAttachment } from '../collections/character-assistant-sessions.collection';
import { CHARACTER_ASSISTANT_ATTACHMENT_KINDS } from './character-assistant-contracts';
import {
  CHARACTER_VISION_REQUEST_SCHEMA,
  CHARACTER_VISION_RESPONSE_SCHEMA,
  formatImageAnalysisAsAttachmentContent,
} from './character-vision-contracts';
import type { iCharacterImageAnalysis } from './character-vision-contracts';
import { deleteCharacterAssetBlob, writeCharacterAssetBlob } from './image-store';

const MAX_REFERENCE_IMAGE_SIDE = 1_024;
const REFERENCE_IMAGE_QUALITY = 0.85;

async function downscaleImageToDataUrl(file: File) {
  const imageBitmap = await createImageBitmap(file);

  try {
    const scale = Math.min(1, MAX_REFERENCE_IMAGE_SIDE / Math.max(imageBitmap.width, imageBitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(imageBitmap.width * scale));
    canvas.height = Math.max(1, Math.round(imageBitmap.height * scale));
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Canvas 2D context is unavailable.');
    }

    context.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) {
            resolve(result);
          } else {
            reject(new Error('The reference image could not be encoded.'));
          }
        },
        'image/jpeg',
        REFERENCE_IMAGE_QUALITY,
      );
    });

    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('The reference image could not be read.'));
      reader.readAsDataURL(blob);
    });
  } finally {
    imageBitmap.close();
  }
}

export interface iAnalyzeCharacterImageOptions {
  characterId: string;
  file: File;
  endpoint: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  userHint?: string;
}

export async function analyzeCharacterImage({
  characterId,
  file,
  endpoint,
  apiKey,
  model,
  maxTokens,
  temperature,
  userHint,
}: iAnalyzeCharacterImageOptions): Promise<{ analysis: iCharacterImageAnalysis; attachmentId: string }> {
  const attachmentId = generateUuid();
  const assetId = `guided-ref:${characterId}:${attachmentId}`;
  const imageDataUrl = await downscaleImageToDataUrl(file);
  const request = CHARACTER_VISION_REQUEST_SCHEMA.parse({
    endpoint,
    apiKey,
    model,
    maxTokens,
    temperature,
    imageDataUrl,
    userHint,
  });
  const response = await fetch('/api/character-vision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error((await response.text()).trim() || 'The image could not be analyzed.');
  }

  const payload = CHARACTER_VISION_RESPONSE_SCHEMA.parse((await response.json()) as unknown);
  await writeCharacterAssetBlob(assetId, file);

  try {
    const session = await appendGuidedAttachment(characterId, {
      id: attachmentId,
      kind: CHARACTER_ASSISTANT_ATTACHMENT_KINDS.imageAnalysis,
      title: 'Character reference image analysis',
      content: formatImageAnalysisAsAttachmentContent(payload.analysis),
      warnings: payload.analysis.warnings,
      confidence: payload.analysis.confidence,
    });
    const hasStoredAttachment = session.guided?.attachments.some((attachment) => attachment.id === attachmentId);
    if (!hasStoredAttachment) {
      throw new Error('The guided image reference is no longer available.');
    }
  } catch (error) {
    await deleteCharacterAssetBlob(assetId);
    throw error;
  }

  return { analysis: payload.analysis, attachmentId };
}
