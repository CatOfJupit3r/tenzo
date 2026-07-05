import type { ChangeEvent } from 'react';

import { Input } from '@~/components/ui/input';
import { Label } from '@~/components/ui/label';
import { Textarea } from '@~/components/ui/textarea';

import { FieldGenerationControls } from './field-generation-controls';

export interface iCharacterFieldProps {
  fieldId: string;
  label: string;
  value: string;
  rows?: number;
  hint?: string;
  instructionValue?: string;
  generationErrorMessage?: string | null;
  isGenerating?: boolean;
  onValueChange: (value: string) => void;
  onInstructionChange?: (value: string) => void;
  onGenerate?: () => void;
  onContinue?: () => void;
  onCancel?: () => void;
}

export function CharacterField({
  fieldId,
  label,
  value,
  rows = 4,
  hint,
  instructionValue = '',
  generationErrorMessage = null,
  isGenerating = false,
  onValueChange,
  onInstructionChange,
  onGenerate,
  onContinue,
  onCancel,
}: iCharacterFieldProps) {
  const hasGenerationControls = onInstructionChange && onGenerate && onContinue && onCancel;

  return (
    <div className="space-y-3">
      <Label htmlFor={fieldId}>{label}</Label>
      {hasGenerationControls ? (
        <FieldGenerationControls
          fieldId={fieldId}
          label={label}
          instructionValue={instructionValue}
          errorMessage={generationErrorMessage}
          hasExistingValue={value.trim().length > 0}
          isGenerating={isGenerating}
          onInstructionChange={onInstructionChange}
          onGenerate={onGenerate}
          onContinue={onContinue}
          onCancel={onCancel}
        />
      ) : null}
      {rows <= 1 ? (
        <Input
          id={fieldId}
          aria-describedby={hint ? `${fieldId}-hint` : undefined}
          value={value}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onValueChange(event.target.value)}
        />
      ) : (
        <Textarea
          id={fieldId}
          aria-describedby={hint ? `${fieldId}-hint` : undefined}
          value={value}
          rows={rows}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onValueChange(event.target.value)}
        />
      )}
      {hint ? (
        <p id={`${fieldId}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
