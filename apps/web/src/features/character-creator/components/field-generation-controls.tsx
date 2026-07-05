import { LuLoaderCircle, LuSparkles, LuSquare, LuStepForward } from 'react-icons/lu';

import { Alert, AlertDescription, AlertTitle } from '@~/components/ui/alert';
import { Button } from '@~/components/ui/button';
import { Label } from '@~/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@~/components/ui/popover';
import { Switch } from '@~/components/ui/switch';
import { Textarea } from '@~/components/ui/textarea';
import { cn } from '@~/lib/utils';

export interface iFieldGenerationControlsProps {
  fieldId: string;
  label: string;
  shouldUseGeneralCharacterIdea: boolean;
  instructionValue: string;
  errorMessage?: string | null;
  hasExistingValue: boolean;
  isGenerating: boolean;
  onShouldUseGeneralCharacterIdeaChange: (value: boolean) => void;
  onInstructionChange: (value: string) => void;
  onGenerate: () => void;
  onContinue: () => void;
  onCancel: () => void;
}

export function FieldGenerationControls({
  fieldId,
  label,
  shouldUseGeneralCharacterIdea,
  instructionValue,
  errorMessage,
  hasExistingValue,
  isGenerating,
  onShouldUseGeneralCharacterIdeaChange,
  onInstructionChange,
  onGenerate,
  onContinue,
  onCancel,
}: iFieldGenerationControlsProps) {
  const instructionId = `${fieldId}-instructions`;
  const shouldShowErrorState = Boolean(errorMessage);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn('w-fit', shouldShowErrorState ? 'border-destructive/60 text-destructive' : null)}
        >
          {isGenerating ? <LuLoaderCircle className="size-4 animate-spin" /> : <LuSparkles className="size-4" />}
          {isGenerating ? 'Generating' : 'AI Generation'}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-80 space-y-3" side="left">
        <div className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2">
          <div className="space-y-1">
            <p className="text-sm font-medium">Use General Character Idea</p>
            <p className="text-xs text-muted-foreground">
              Applies the shared character idea to this field&apos;s generation prompt.
            </p>
          </div>
          <Switch
            checked={shouldUseGeneralCharacterIdea}
            aria-label={`Use general character idea for ${label}`}
            onCheckedChange={onShouldUseGeneralCharacterIdeaChange}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor={instructionId}>AI instructions for {label}</Label>
          <Textarea
            id={instructionId}
            rows={3}
            value={instructionValue}
            placeholder="Optional guidance for this field"
            onChange={(event) => onInstructionChange(event.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" disabled={isGenerating} onClick={onGenerate}>
            {isGenerating ? <LuLoaderCircle className="size-4 animate-spin" /> : <LuSparkles className="size-4" />}
            Generate
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isGenerating || !hasExistingValue}
            onClick={onContinue}
          >
            <LuStepForward className="size-4" />
            Continue
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={!isGenerating} onClick={onCancel}>
            <LuSquare className="size-4" />
            Cancel
          </Button>
        </div>

        {errorMessage ? (
          <Alert variant="destructive">
            <AlertTitle>Generation failed</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
