import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LuLocateFixed } from 'react-icons/lu';

import { Button } from '@~/components/ui/button';
import { Cropper, CropperArea, CropperImage } from '@~/components/ui/cropper';
import type { iArea, iMediaSize, iPoint, iSize } from '@~/components/ui/cropper';

import {
  arePortraitCropRectsEqual,
  getDefaultPortraitCropRect,
  getPortraitCropRect,
  getPortraitCropRectFromPercentages,
  getPortraitEditorTransform,
  MAX_PORTRAIT_EDITOR_ZOOM,
  MIN_PORTRAIT_EDITOR_ZOOM,
  SILLY_TAVERN_PORTRAIT_ASPECT_RATIO,
} from '../lib/portrait-focal-point';
import type { iPortraitCropRect, iPortraitDimensions } from '../lib/portrait-focal-point';

export interface iPortraitFocalPointEditorProps {
  cropRect: iPortraitCropRect;
  onCropRectChange: (cropRect: iPortraitCropRect) => void;
  portraitDimensions: iPortraitDimensions;
  portraitUrl: string;
}

function serializeCropRect(cropRect: iPortraitCropRect) {
  return `${cropRect.x}:${cropRect.y}:${cropRect.width}:${cropRect.height}`;
}

export function PortraitFocalPointEditor({
  cropRect,
  onCropRectChange,
  portraitDimensions,
  portraitUrl,
}: iPortraitFocalPointEditorProps) {
  const [crop, setCrop] = useState<iPoint>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(MIN_PORTRAIT_EDITOR_ZOOM);
  const [mediaSize, setMediaSize] = useState<iMediaSize | null>(null);
  const [cropSize, setCropSize] = useState<iSize | null>(null);
  const [hasInitializedEditor, setHasInitializedEditor] = useState(false);
  const lastAppliedCropRectSignatureRef = useRef<string | null>(null);
  const safeCropRect = useMemo(() => getPortraitCropRect(portraitDimensions, cropRect), [cropRect, portraitDimensions]);
  const defaultCropRect = useMemo(() => getDefaultPortraitCropRect(portraitDimensions), [portraitDimensions]);
  const isDefaultCrop = arePortraitCropRectsEqual(safeCropRect, defaultCropRect);

  useEffect(() => {
    setHasInitializedEditor(false);
    lastAppliedCropRectSignatureRef.current = null;
  }, [portraitUrl]);

  useEffect(() => {
    if (!mediaSize || !cropSize) {
      return;
    }

    const safeCropRectSignature = serializeCropRect(safeCropRect);
    if (hasInitializedEditor && lastAppliedCropRectSignatureRef.current === safeCropRectSignature) {
      return;
    }

    const editorTransform = getPortraitEditorTransform(portraitDimensions, safeCropRect, mediaSize, cropSize);
    lastAppliedCropRectSignatureRef.current = safeCropRectSignature;
    setCrop({
      x: editorTransform.x,
      y: editorTransform.y,
    });
    setZoom(editorTransform.zoom);
    setHasInitializedEditor(true);
  }, [cropSize, hasInitializedEditor, mediaSize, portraitDimensions, safeCropRect]);

  const handleCropAreaChange = useCallback(
    (croppedArea: iArea) => {
      if (!hasInitializedEditor) {
        return;
      }

      const nextCropRect = getPortraitCropRectFromPercentages(portraitDimensions, croppedArea);
      const nextCropRectSignature = serializeCropRect(nextCropRect);
      if (lastAppliedCropRectSignatureRef.current === nextCropRectSignature) {
        return;
      }

      lastAppliedCropRectSignatureRef.current = nextCropRectSignature;
      onCropRectChange(nextCropRect);
    },
    [hasInitializedEditor, onCropRectChange, portraitDimensions],
  );

  const handleResetCrop = useCallback(() => {
    if (!mediaSize || !cropSize) {
      return;
    }

    const resetCropRect = getDefaultPortraitCropRect(portraitDimensions);
    const editorTransform = getPortraitEditorTransform(portraitDimensions, resetCropRect, mediaSize, cropSize);

    lastAppliedCropRectSignatureRef.current = serializeCropRect(resetCropRect);
    setCrop({
      x: editorTransform.x,
      y: editorTransform.y,
    });
    setZoom(editorTransform.zoom);
    setHasInitializedEditor(true);
    onCropRectChange(resetCropRect);
  }, [cropSize, mediaSize, onCropRectChange, portraitDimensions]);

  const handleZoomChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setZoom(Number(event.target.value));
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-medium">Portrait crop</p>
        </div>

        <Button disabled={isDefaultCrop} type="button" variant="outline" onClick={handleResetCrop}>
          <LuLocateFixed className="size-4" />
          Reset
        </Button>
      </div>

      <div className="mx-auto w-full max-w-110 space-y-3">
        <div
          className="relative overflow-hidden rounded-xl border bg-black/90"
          style={{ aspectRatio: `${SILLY_TAVERN_PORTRAIT_ASPECT_RATIO}` }}
        >
          <Cropper
            aspectRatio={SILLY_TAVERN_PORTRAIT_ASPECT_RATIO}
            crop={crop}
            zoom={zoom}
            minZoom={MIN_PORTRAIT_EDITOR_ZOOM}
            maxZoom={MAX_PORTRAIT_EDITOR_ZOOM}
            shouldHaveGrid
            onCropAreaChange={handleCropAreaChange}
            onCropChange={setCrop}
            onCropSizeChange={setCropSize}
            onMediaLoaded={setMediaSize}
            onZoomChange={setZoom}
          >
            <CropperImage alt="Portrait crop editor" src={portraitUrl} />
            <CropperArea />
          </Cropper>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
            <span>Zoom</span>
            <span>{Math.round(zoom * 100)}%</span>
          </div>
          <input
            aria-label="Portrait crop zoom"
            className="h-2 w-full cursor-pointer accent-foreground"
            max={MAX_PORTRAIT_EDITOR_ZOOM}
            min={MIN_PORTRAIT_EDITOR_ZOOM}
            step={0.01}
            type="range"
            value={zoom}
            onChange={handleZoomChange}
          />
        </div>
      </div>
    </div>
  );
}
