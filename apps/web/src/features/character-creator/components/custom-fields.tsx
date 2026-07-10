import type { ChangeEvent } from 'react';
import { LuPlus, LuSparkles, LuTrash2 } from 'react-icons/lu';

import { Button } from '@~/components/ui/button';
import { Input } from '@~/components/ui/input';

import type { iFieldGenerationState } from '../hooks/use-character-creator-page';
import type { CustomField } from '../lib/card-schema';
import { TEMPLATE_FIELD_KEYS } from '../lib/field-templates';
import type { iCreateStoredFieldTemplateInput, iFieldTemplateViewModel } from '../lib/field-templates';
import { MarkdownFieldEditor } from './editor/markdown-field-editor';
import { RewriteDiffReview } from './editor/rewrite-diff-review';
import { FieldGenerationControls } from './field-generation-controls';

export interface iCustomFieldsProps {
  fields: CustomField[];
  generationStates: Record<string, iFieldGenerationState>;
  templateOptions: iFieldTemplateViewModel[];
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<Pick<CustomField, 'label' | 'value'>>) => void;
  onRemove: (id: string) => void;
  onTemplateIdChange: (id: string, templateId: string | null) => void;
  onSaveTemplate: (input: iCreateStoredFieldTemplateInput) => void;
  onShouldUseGeneralCharacterIdeaChange: (id: string, value: boolean) => void;
  onInstructionChange: (id: string, value: string) => void;
  onGenerate: (id: string) => void;
  onContinue: (id: string) => void;
  onRewrite: (id: string) => void;
  onRevertRewrite: (id: string) => void;
  onAcceptRewrite: (id: string) => void;
  onResolveRewriteReview: (id: string, mergedValue: string) => void;
  onCancel: (id: string) => void;
  onAskAssistant?: () => void;
}

export function CustomFields({
  fields,
  generationStates,
  templateOptions,
  onAdd,
  onUpdate,
  onRemove,
  onTemplateIdChange,
  onSaveTemplate,
  onShouldUseGeneralCharacterIdeaChange,
  onInstructionChange,
  onGenerate,
  onContinue,
  onRewrite,
  onRevertRewrite,
  onAcceptRewrite,
  onResolveRewriteReview,
  onCancel,
  onAskAssistant,
}: iCustomFieldsProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm leading-none font-medium">Custom Fields</span>
        <div className="flex gap-2">
          {onAskAssistant ? (
            <Button type="button" variant="ghost" size="sm" onClick={onAskAssistant}>
              <LuSparkles className="size-3.5" />
              Ask AI
            </Button>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={onAdd}>
            <LuPlus className="size-4" />
            Add field
          </Button>
        </div>
      </div>

      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">No custom fields yet.</p>
      ) : (
        <div className="space-y-3">
          {fields.map((field) => {
            const generationState = generationStates[field.id];
            const isGenerating = generationState?.isGenerating ?? false;
            const shouldShowRewriteReview =
              (generationState?.isRewriteReviewPending ?? false) &&
              generationState?.rewriteBackupValue != null &&
              !isGenerating;

            return (
              <div key={field.id} className="space-y-3 rounded-md border p-3">
                <div className="flex items-start gap-2">
                  <Input
                    aria-label="Custom field name"
                    placeholder="Field name"
                    value={field.label}
                    className="w-52 shrink-0"
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      onUpdate(field.id, { label: event.target.value })
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    tooltip="Remove field"
                    onClick={() => onRemove(field.id)}
                  >
                    <LuTrash2 className="size-4" />
                  </Button>
                </div>

                <FieldGenerationControls
                  fieldId={`custom-field-${field.id}`}
                  label={field.label.trim() || 'Custom Field'}
                  shouldUseGeneralCharacterIdea={generationState?.shouldUseGeneralCharacterIdea ?? true}
                  instructionValue={generationState?.instructionValue ?? ''}
                  errorMessage={generationState?.errorMessage ?? null}
                  hasExistingValue={field.value.trim().length > 0}
                  hasRewriteBackup={generationState?.hasRewriteBackup ?? false}
                  isGenerating={isGenerating}
                  templateOptions={templateOptions}
                  templateId={generationState?.templateId ?? null}
                  isStrictTemplateSelected={generationState?.isStrictTemplateSelected ?? false}
                  fieldValue={field.value}
                  templateFieldKey={TEMPLATE_FIELD_KEYS.custom_field}
                  onTemplateIdChange={(templateId) => onTemplateIdChange(field.id, templateId)}
                  onSaveTemplate={onSaveTemplate}
                  onShouldUseGeneralCharacterIdeaChange={(value) =>
                    onShouldUseGeneralCharacterIdeaChange(field.id, value)
                  }
                  onInstructionChange={(value) => onInstructionChange(field.id, value)}
                  onGenerate={() => onGenerate(field.id)}
                  onContinue={() => onContinue(field.id)}
                  onRewrite={() => onRewrite(field.id)}
                  onRevertRewrite={() => onRevertRewrite(field.id)}
                  onCancel={() => onCancel(field.id)}
                />

                {shouldShowRewriteReview ? (
                  <RewriteDiffReview
                    oldValue={generationState?.rewriteBackupValue ?? ''}
                    newValue={field.value}
                    onResolve={(mergedValue) => onResolveRewriteReview(field.id, mergedValue)}
                    onAcceptAll={() => onAcceptRewrite(field.id)}
                    onRevertAll={() => onRevertRewrite(field.id)}
                  />
                ) : (
                  <MarkdownFieldEditor
                    fieldId={`custom-field-${field.id}-editor`}
                    value={field.value}
                    rows={3}
                    placeholder="Value"
                    isReadOnly={isGenerating}
                    isStreaming={isGenerating}
                    onValueChange={(value) => onUpdate(field.id, { value })}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
