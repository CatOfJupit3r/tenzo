import { LuLoaderCircle, LuSparkles, LuSquare, LuStepForward } from 'react-icons/lu';

import { Alert, AlertDescription, AlertTitle } from '@~/components/ui/alert';
import { Button } from '@~/components/ui/button';
import { Label } from '@~/components/ui/label';
import { Textarea } from '@~/components/ui/textarea';

export interface iFieldGenerationControlsProps {
  fieldId: string;
  label: string;
  instructionValue: string;
  errorMessage?: string | null;
  hasExistingValue: boolean;
  isGenerating: boolean;
  onInstructionChange: (value: string) => void;
  onGenerate: () => void;
  onContinue: () => void;
  onCancel: () => void;
}

export function FieldGenerationControls({
  fieldId,
  label,
  instructionValue,
  errorMessage,
  hasExistingValue,
  isGenerating,
  onInstructionChange,
  onGenerate,
  onContinue,
  onCancel,
}: iFieldGenerationControlsProps) {
  const instructionId = `${fieldId}-instructions`;

  return (
    <div className="space-y-2 rounded-lg border border-dashed p-3">
      <div className="space-y-1">
        <Label htmlFor={instructionId}>AI instructions for {label}</Label>
        <Textarea
          id={instructionId}
          rows={2}
          value={instructionValue}
          placeholder="Optional guidance for this field"
          onChange={(event) => onInstructionChange(event.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" disabled={isGenerating} onClick={onGenerate}>
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
    </div>
  );
}
