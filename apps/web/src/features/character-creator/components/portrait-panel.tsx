import { Card, CardContent, CardHeader, CardTitle } from '@~/components/ui/card';

import { useCharacterCreatorContext } from '../context/character-creator-context/character-creator-context.hooks';
import { ImageUpload } from './image-upload';

export function PortraitPanel() {
  const {
    portraitReference,
    portraitDimensions,
    portraitCropRect,
    portraitObjectUrl,
    isHydratingPortrait,
    handlePortraitSelect,
    updatePortraitCropRect,
    clearPortrait,
  } = useCharacterCreatorContext();

  return (
    <div className="lg:sticky lg:top-32 lg:self-start">
      <Card className="gap-3 bg-card/95 py-4 shadow-sm">
        <CardHeader className="px-4">
          <CardTitle className="text-sm">Portrait</CardTitle>
        </CardHeader>
        <CardContent className="px-3">
          <ImageUpload
            portraitFileName={portraitReference?.fileName ?? null}
            portraitDimensions={portraitDimensions}
            portraitCropRect={portraitCropRect}
            portraitUrl={portraitObjectUrl}
            isHydratingPortrait={isHydratingPortrait}
            onSelectFile={handlePortraitSelect}
            onCropRectChange={updatePortraitCropRect}
            onClear={clearPortrait}
          />
        </CardContent>
      </Card>
    </div>
  );
}
