import type { iArea, iMediaSize, iSize } from '@~/components/ui/cropper';

export const SILLY_TAVERN_PORTRAIT_ASPECT_RATIO = 2 / 3;
export const SILLY_TAVERN_PORTRAIT_WIDTH = 512;
export const SILLY_TAVERN_PORTRAIT_HEIGHT = 768;
export const MIN_PORTRAIT_EDITOR_ZOOM = 1;
export const MAX_PORTRAIT_EDITOR_ZOOM = 6;

export interface iPortraitDimensions {
  width: number;
  height: number;
}

export interface iPortraitCropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface iPortraitEditorTransform {
  x: number;
  y: number;
  zoom: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isValidStoredCropRect(cropRect: Partial<iPortraitCropRect> | null | undefined): cropRect is iPortraitCropRect {
  return (
    isFiniteNumber(cropRect?.x) &&
    isFiniteNumber(cropRect?.y) &&
    isFiniteNumber(cropRect?.width) &&
    isFiniteNumber(cropRect?.height) &&
    cropRect.width > 0 &&
    cropRect.height > 0
  );
}

export function arePortraitCropRectsEqual(left: iPortraitCropRect | null, right: iPortraitCropRect | null) {
  if (!left || !right) {
    return left === right;
  }

  return (
    Math.abs(left.x - right.x) < 0.5 &&
    Math.abs(left.y - right.y) < 0.5 &&
    Math.abs(left.width - right.width) < 0.5 &&
    Math.abs(left.height - right.height) < 0.5
  );
}

export function sanitizeStoredPortraitCropRect(
  cropRect: Partial<iPortraitCropRect> | null | undefined,
): iPortraitCropRect | null {
  if (!isValidStoredCropRect(cropRect)) {
    return null;
  }

  return {
    x: cropRect.x,
    y: cropRect.y,
    width: cropRect.width,
    height: cropRect.height,
  };
}

export function getDefaultPortraitCropRect(dimensions: iPortraitDimensions): iPortraitCropRect {
  const imageAspectRatio = dimensions.width / dimensions.height;
  const cropWidth =
    imageAspectRatio > SILLY_TAVERN_PORTRAIT_ASPECT_RATIO
      ? dimensions.height * SILLY_TAVERN_PORTRAIT_ASPECT_RATIO
      : dimensions.width;
  const cropHeight =
    imageAspectRatio > SILLY_TAVERN_PORTRAIT_ASPECT_RATIO
      ? dimensions.height
      : dimensions.width / SILLY_TAVERN_PORTRAIT_ASPECT_RATIO;

  return {
    x: (dimensions.width - cropWidth) / 2,
    y: (dimensions.height - cropHeight) / 2,
    width: cropWidth,
    height: cropHeight,
  };
}

export function getPortraitCropRect(
  dimensions: iPortraitDimensions,
  cropRect: Partial<iPortraitCropRect> | null | undefined,
): iPortraitCropRect {
  const defaultCropRect = getDefaultPortraitCropRect(dimensions);

  if (!isValidStoredCropRect(cropRect)) {
    return defaultCropRect;
  }

  let width = clamp(cropRect.width, 1, dimensions.width);
  let height = clamp(cropRect.height, 1, dimensions.height);
  const widthFromHeight = height * SILLY_TAVERN_PORTRAIT_ASPECT_RATIO;
  const heightFromWidth = width / SILLY_TAVERN_PORTRAIT_ASPECT_RATIO;

  if (widthFromHeight <= width) {
    width = widthFromHeight;
  } else {
    height = heightFromWidth;
  }

  width = Math.min(width, dimensions.width);
  height = Math.min(height, dimensions.height);

  return {
    x: clamp(cropRect.x, 0, dimensions.width - width),
    y: clamp(cropRect.y, 0, dimensions.height - height),
    width,
    height,
  };
}

export function getPortraitCropRectFromPercentages(
  dimensions: iPortraitDimensions,
  croppedAreaPercentages: Pick<iArea, 'x' | 'y' | 'width' | 'height'>,
): iPortraitCropRect {
  return getPortraitCropRect(dimensions, {
    x: (dimensions.width * croppedAreaPercentages.x) / 100,
    y: (dimensions.height * croppedAreaPercentages.y) / 100,
    width: (dimensions.width * croppedAreaPercentages.width) / 100,
    height: (dimensions.height * croppedAreaPercentages.height) / 100,
  });
}

export function getPortraitEditorTransform(
  dimensions: iPortraitDimensions,
  cropRect: Partial<iPortraitCropRect> | null | undefined,
  mediaSize: iMediaSize,
  cropSize: iSize,
): iPortraitEditorTransform {
  const safeCropRect = getPortraitCropRect(dimensions, cropRect);
  const widthRatio = safeCropRect.width / dimensions.width;
  const heightRatio = safeCropRect.height / dimensions.height;
  const zoom = clamp(
    cropSize.width / (mediaSize.width * widthRatio),
    MIN_PORTRAIT_EDITOR_ZOOM,
    MAX_PORTRAIT_EDITOR_ZOOM,
  );

  return {
    x: zoom * ((mediaSize.width * (1 - widthRatio)) / 2 - (mediaSize.width * safeCropRect.x) / dimensions.width),
    y: zoom * ((mediaSize.height * (1 - heightRatio)) / 2 - (mediaSize.height * safeCropRect.y) / dimensions.height),
    zoom,
  };
}

export function getSillyTavernAvatarCropRect(
  dimensions: iPortraitDimensions,
  cropRect: Partial<iPortraitCropRect> | null | undefined,
): iPortraitCropRect {
  const portraitCropRect = getPortraitCropRect(dimensions, cropRect);
  const squareSize = portraitCropRect.width;

  return {
    x: portraitCropRect.x,
    y: portraitCropRect.y + (portraitCropRect.height - squareSize) / 2,
    width: squareSize,
    height: squareSize,
  };
}

export async function readPortraitDimensions(blob: Blob): Promise<iPortraitDimensions> {
  const imageBitmap = await createImageBitmap(blob);

  try {
    return {
      width: imageBitmap.width,
      height: imageBitmap.height,
    };
  } finally {
    imageBitmap.close();
  }
}

export async function renderPortraitBlobWithCrop(
  sourceBlob: Blob,
  cropRect: Partial<iPortraitCropRect> | null | undefined,
): Promise<Blob> {
  const imageBitmap = await createImageBitmap(sourceBlob);

  try {
    const safeCropRect = getPortraitCropRect(
      {
        width: imageBitmap.width,
        height: imageBitmap.height,
      },
      cropRect,
    );

    const canvas = document.createElement('canvas');
    canvas.width = SILLY_TAVERN_PORTRAIT_WIDTH;
    canvas.height = SILLY_TAVERN_PORTRAIT_HEIGHT;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas 2D context is unavailable.');
    }

    context.drawImage(
      imageBitmap,
      safeCropRect.x,
      safeCropRect.y,
      safeCropRect.width,
      safeCropRect.height,
      0,
      0,
      SILLY_TAVERN_PORTRAIT_WIDTH,
      SILLY_TAVERN_PORTRAIT_HEIGHT,
    );

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error('Failed to encode portrait as PNG.'));
      }, 'image/png');
    });
  } finally {
    imageBitmap.close();
  }
}
