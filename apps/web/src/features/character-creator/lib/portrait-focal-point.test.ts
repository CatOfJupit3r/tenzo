import { describe, expect, it } from 'vitest';

import {
  getDefaultPortraitCropRect,
  getPortraitCropRect,
  getPortraitEditorTransform,
  getSillyTavernAvatarCropRect,
  SILLY_TAVERN_PORTRAIT_ASPECT_RATIO,
} from './portrait-focal-point';

describe('portrait crop geometry', () => {
  it('centers the largest 2:3 portrait crop when the source image is wider than the export ratio', () => {
    const cropRect = getDefaultPortraitCropRect({ width: 1600, height: 1200 });

    expect(cropRect.width / cropRect.height).toBeCloseTo(SILLY_TAVERN_PORTRAIT_ASPECT_RATIO, 6);
    expect(cropRect).toEqual({
      x: 400,
      y: 0,
      width: 800,
      height: 1200,
    });
  });

  it('sanitizes a requested crop while preserving the export aspect ratio', () => {
    const cropRect = getPortraitCropRect({ width: 1200, height: 1600 }, { x: -120, y: 80, width: 900, height: 1200 });

    expect(cropRect).toEqual({
      x: 0,
      y: 80,
      width: 800,
      height: 1200,
    });
  });

  it('reconstructs cropper zoom and position from the saved crop rectangle', () => {
    const editorTransform = getPortraitEditorTransform(
      { width: 1600, height: 1200 },
      { x: 600, y: 300, width: 400, height: 600 },
      { width: 400, height: 300, naturalWidth: 1600, naturalHeight: 1200 },
      { width: 200, height: 300 },
    );

    expect(editorTransform.zoom).toBeCloseTo(2, 6);
    expect(editorTransform.x).toBeCloseTo(0, 6);
    expect(editorTransform.y).toBeCloseTo(0, 6);
  });

  it('derives the square SillyTavern avatar crop from the exported portrait crop', () => {
    const avatarCropRect = getSillyTavernAvatarCropRect(
      { width: 900, height: 1600 },
      { x: 0, y: 125, width: 900, height: 1350 },
    );

    expect(avatarCropRect.width).toBeCloseTo(900, 6);
    expect(avatarCropRect.height).toBeCloseTo(900, 6);
    expect(avatarCropRect.x).toBeCloseTo(0, 6);
    expect(avatarCropRect.y).toBeCloseTo(350, 6);
  });
});
