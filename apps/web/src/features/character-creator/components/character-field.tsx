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
  shouldUseGeneralCharacterIdea?: boolean;
  instructionValue?: string;
  generationErrorMessage?: string | null;
  isGenerating?: boolean;
  hasRewriteBackup?: boolean;
  onValueChange: (value: string) => void;
  onShouldUseGeneralCharacterIdeaChange?: (value: boolean) => void;
  onInstructionChange?: (value: string) => void;
  onGenerate?: () => void;
  onContinue?: () => void;
  onRewrite?: () => void;
  onRevertRewrite?: () => void;
  onCancel?: () => void;
}

export function CharacterField({
  fieldId,
  label,
  value,
  rows = 4,
  hint,
  shouldUseGeneralCharacterIdea = true,
  instructionValue = '',
  generationErrorMessage = null,
  isGenerating = false,
  hasRewriteBackup = false,
  onValueChange,
  onShouldUseGeneralCharacterIdeaChange,
  onInstructionChange,
  onGenerate,
  onContinue,
  onRewrite,
  onRevertRewrite,
  onCancel,
}: iCharacterFieldProps) {
  const hasGenerationControls =
    onShouldUseGeneralCharacterIdeaChange && onInstructionChange && onGenerate && onContinue && onRewrite && onCancel;

  return (
    <div className="space-y-3">
      <Label htmlFor={fieldId}>{label}</Label>
      {hasGenerationControls ? (
        <FieldGenerationControls
          fieldId={fieldId}
          label={label}
          shouldUseGeneralCharacterIdea={shouldUseGeneralCharacterIdea}
          instructionValue={instructionValue}
          errorMessage={generationErrorMessage}
          hasExistingValue={value.trim().length > 0}
          hasRewriteBackup={hasRewriteBackup}
          isGenerating={isGenerating}
          onShouldUseGeneralCharacterIdeaChange={onShouldUseGeneralCharacterIdeaChange}
          onInstructionChange={onInstructionChange}
          onGenerate={onGenerate}
          onContinue={onContinue}
          onRewrite={onRewrite}
          onRevertRewrite={onRevertRewrite ?? (() => undefined)}
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
