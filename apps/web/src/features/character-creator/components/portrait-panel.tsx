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
    <div className="space-y-6 lg:sticky lg:self-start">
      <Card className="gap-4 bg-card/95 shadow-sm">
        <CardHeader>
          <CardTitle>Portrait</CardTitle>
        </CardHeader>
        <CardContent>
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
