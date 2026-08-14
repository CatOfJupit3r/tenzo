import { Badge } from '@~/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@~/components/ui/card';

import { useCharacterCreatorContext } from '../context/character-creator-context/character-creator-context.hooks';
import { ImageUpload } from './image-upload';

export function PortraitPanel() {
  const {
    portraitReference,
    data,
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
          <div className="mt-4 border-t px-1 pt-4">
            <p className="truncate text-lg font-semibold">{data.name.trim() || 'Untitled character'}</p>
            <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
              {data.description.trim() || 'Ready for character details.'}
            </p>
            {data.tags.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {data.tags.slice(0, 4).map((tag) => (
                  <Badge key={tag} variant="outline" className="max-w-full truncate">
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
