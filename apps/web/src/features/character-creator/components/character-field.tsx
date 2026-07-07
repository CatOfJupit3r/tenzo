import type { ChangeEvent } from 'react';

import { Input } from '@~/components/ui/input';
import { Label } from '@~/components/ui/label';

import type { FieldEditorVariant } from '../constants/field-config';
import { FIELD_EDITOR_VARIANTS } from '../constants/field-config';
import type {
  iCreateStoredFieldTemplateInput,
  iFieldTemplateViewModel,
  TemplateFieldKey,
} from '../lib/field-templates';
import { MarkdownFieldEditor } from './editor/markdown-field-editor';
import { MesExampleEditor } from './editor/mes-example-editor';
import { RewriteDiffReview } from './editor/rewrite-diff-review';
import { FieldGenerationControls } from './field-generation-controls';

export interface iCharacterFieldProps {
  fieldId: string;
  label: string;
  value: string;
  rows?: number;
  hint?: string;
  editorVariant?: FieldEditorVariant;
  doesAllowOriginalMacro?: boolean;
  shouldUseGeneralCharacterIdea?: boolean;
  instructionValue?: string;
  generationErrorMessage?: string | null;
  isGenerating?: boolean;
  hasRewriteBackup?: boolean;
  isRewriteReviewPending?: boolean;
  rewriteBackupValue?: string | null;
  templateOptions?: iFieldTemplateViewModel[];
  templateId?: string | null;
  isStrictTemplateSelected?: boolean;
  templateFieldKey?: TemplateFieldKey | null;
  onTemplateIdChange?: (templateId: string | null) => void;
  onSaveTemplate?: (input: iCreateStoredFieldTemplateInput) => void;
  onValueChange: (value: string) => void;
  onShouldUseGeneralCharacterIdeaChange?: (value: boolean) => void;
  onInstructionChange?: (value: string) => void;
  onGenerate?: () => void;
  onContinue?: () => void;
  onRewrite?: () => void;
  onRevertRewrite?: () => void;
  onAcceptRewrite?: () => void;
  onResolveRewriteReview?: (mergedValue: string) => void;
  onCancel?: () => void;
}

export function CharacterField({
  fieldId,
  label,
  value,
  rows = 4,
  hint,
  editorVariant,
  doesAllowOriginalMacro = false,
  shouldUseGeneralCharacterIdea = true,
  instructionValue = '',
  generationErrorMessage = null,
  isGenerating = false,
  hasRewriteBackup = false,
  isRewriteReviewPending = false,
  rewriteBackupValue = null,
  templateOptions = [],
  templateId = null,
  isStrictTemplateSelected = false,
  templateFieldKey = null,
  onTemplateIdChange,
  onSaveTemplate,
  onValueChange,
  onShouldUseGeneralCharacterIdeaChange,
  onInstructionChange,
  onGenerate,
  onContinue,
  onRewrite,
  onRevertRewrite,
  onAcceptRewrite,
  onResolveRewriteReview,
  onCancel,
}: iCharacterFieldProps) {
  const hasGenerationControls =
    onShouldUseGeneralCharacterIdeaChange && onInstructionChange && onGenerate && onContinue && onRewrite && onCancel;

  const resolvedVariant = editorVariant ?? (rows <= 1 ? FIELD_EDITOR_VARIANTS.plain : FIELD_EDITOR_VARIANTS.markdown);
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const shouldShowRewriteReview =
    isRewriteReviewPending && rewriteBackupValue !== null && !isGenerating && onResolveRewriteReview && onAcceptRewrite;

  const renderFieldBody = () => {
    if (shouldShowRewriteReview) {
      return (
        <RewriteDiffReview
          oldValue={rewriteBackupValue}
          newValue={value}
          onResolve={onResolveRewriteReview}
          onAcceptAll={onAcceptRewrite}
          onRevertAll={onRevertRewrite ?? (() => undefined)}
        />
      );
    }
    if (resolvedVariant === FIELD_EDITOR_VARIANTS.plain || rows <= 1) {
      return (
        <Input
          id={fieldId}
          aria-describedby={hintId}
          value={value}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onValueChange(event.target.value)}
        />
      );
    }
    if (resolvedVariant === FIELD_EDITOR_VARIANTS.mesExample) {
      return (
        <MesExampleEditor
          fieldId={fieldId}
          value={value}
          rows={rows}
          isReadOnly={isGenerating}
          isStreaming={isGenerating}
          ariaDescribedBy={hintId}
          onValueChange={onValueChange}
        />
      );
    }
    return (
      <MarkdownFieldEditor
        fieldId={fieldId}
        value={value}
        rows={rows}
        isReadOnly={isGenerating}
        isStreaming={isGenerating}
        doesAllowOriginalMacro={doesAllowOriginalMacro}
        ariaDescribedBy={hintId}
        onValueChange={onValueChange}
      />
    );
  };

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
          templateOptions={templateOptions}
          templateId={templateId}
          isStrictTemplateSelected={isStrictTemplateSelected}
          fieldValue={value}
          templateFieldKey={templateFieldKey}
          onTemplateIdChange={onTemplateIdChange}
          onSaveTemplate={onSaveTemplate}
          onShouldUseGeneralCharacterIdeaChange={onShouldUseGeneralCharacterIdeaChange}
          onInstructionChange={onInstructionChange}
          onGenerate={onGenerate}
          onContinue={onContinue}
          onRewrite={onRewrite}
          onRevertRewrite={onRevertRewrite ?? (() => undefined)}
          onCancel={onCancel}
        />
      ) : null}
      {renderFieldBody()}
      {hint ? (
        <p id={`${fieldId}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
