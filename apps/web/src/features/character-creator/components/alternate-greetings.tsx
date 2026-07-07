import { LuChevronDown, LuChevronUp, LuPlus, LuTrash2 } from 'react-icons/lu';

import { Button } from '@~/components/ui/button';

import type { iFieldGenerationState } from '../hooks/use-character-creator-page';
import { TEMPLATE_FIELD_KEYS } from '../lib/field-templates';
import type { iCreateStoredFieldTemplateInput, iFieldTemplateViewModel } from '../lib/field-templates';
import { MarkdownFieldEditor } from './editor/markdown-field-editor';
import { RewriteDiffReview } from './editor/rewrite-diff-review';
import { FieldGenerationControls } from './field-generation-controls';

export interface iAlternateGreetingsProps {
  greetings: string[];
  generationStates: iFieldGenerationState[];
  templateOptions: iFieldTemplateViewModel[];
  onAdd: () => void;
  onChange: (index: number, value: string) => void;
  onRemove: (index: number) => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  onTemplateIdChange: (index: number, templateId: string | null) => void;
  onSaveTemplate: (input: iCreateStoredFieldTemplateInput) => void;
  onShouldUseGeneralCharacterIdeaChange: (index: number, value: boolean) => void;
  onInstructionChange: (index: number, value: string) => void;
  onGenerate: (index: number) => void;
  onContinue: (index: number) => void;
  onRewrite: (index: number) => void;
  onRevertRewrite: (index: number) => void;
  onAcceptRewrite: (index: number) => void;
  onResolveRewriteReview: (index: number, mergedValue: string) => void;
  onCancel: (index: number) => void;
}

export function AlternateGreetings({
  greetings,
  generationStates,
  templateOptions,
  onAdd,
  onChange,
  onRemove,
  onMove,
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
}: iAlternateGreetingsProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm leading-none font-medium">Alternate Greetings</span>
        <Button type="button" variant="outline" size="sm" onClick={onAdd}>
          <LuPlus className="size-4" />
          Add greeting
        </Button>
      </div>

      {greetings.length === 0 ? (
        <p className="text-sm text-muted-foreground">No alternate greetings yet.</p>
      ) : (
        <div className="space-y-3">
          {greetings.map((greeting, index) => {
            const generationState = generationStates[index];
            const isGenerating = generationState?.isGenerating ?? false;
            const shouldShowRewriteReview =
              (generationState?.isRewriteReviewPending ?? false) &&
              generationState?.rewriteBackupValue != null &&
              !isGenerating;

            return (
              // eslint-disable-next-line react/no-array-index-key
              <div key={index} className="space-y-3 rounded-md border p-3">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-medium">Greeting {index + 1}</span>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={index === 0}
                      tooltip="Move up"
                      onClick={() => onMove(index, index - 1)}
                    >
                      <LuChevronUp className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={index === greetings.length - 1}
                      tooltip="Move down"
                      onClick={() => onMove(index, index + 1)}
                    >
                      <LuChevronDown className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      tooltip="Remove greeting"
                      onClick={() => onRemove(index)}
                    >
                      <LuTrash2 className="size-4" />
                    </Button>
                  </div>
                </div>

                <FieldGenerationControls
                  fieldId={`alternate-greeting-${index}`}
                  label={`Alternate Greeting ${index + 1}`}
                  shouldUseGeneralCharacterIdea={generationState?.shouldUseGeneralCharacterIdea ?? true}
                  instructionValue={generationState?.instructionValue ?? ''}
                  errorMessage={generationState?.errorMessage ?? null}
                  hasExistingValue={greeting.trim().length > 0}
                  hasRewriteBackup={generationState?.hasRewriteBackup ?? false}
                  isGenerating={isGenerating}
                  templateOptions={templateOptions}
                  templateId={generationState?.templateId ?? null}
                  isStrictTemplateSelected={generationState?.isStrictTemplateSelected ?? false}
                  fieldValue={greeting}
                  templateFieldKey={TEMPLATE_FIELD_KEYS.alternate_greeting}
                  onTemplateIdChange={(templateId) => onTemplateIdChange(index, templateId)}
                  onSaveTemplate={onSaveTemplate}
                  onShouldUseGeneralCharacterIdeaChange={(value) => onShouldUseGeneralCharacterIdeaChange(index, value)}
                  onInstructionChange={(value) => onInstructionChange(index, value)}
                  onGenerate={() => onGenerate(index)}
                  onContinue={() => onContinue(index)}
                  onRewrite={() => onRewrite(index)}
                  onRevertRewrite={() => onRevertRewrite(index)}
                  onCancel={() => onCancel(index)}
                />

                {shouldShowRewriteReview ? (
                  <RewriteDiffReview
                    oldValue={generationState?.rewriteBackupValue ?? ''}
                    newValue={greeting}
                    onResolve={(mergedValue) => onResolveRewriteReview(index, mergedValue)}
                    onAcceptAll={() => onAcceptRewrite(index)}
                    onRevertAll={() => onRevertRewrite(index)}
                  />
                ) : (
                  <MarkdownFieldEditor
                    fieldId={`alternate-greeting-${index}-editor`}
                    value={greeting}
                    rows={4}
                    isReadOnly={isGenerating}
                    isStreaming={isGenerating}
                    onValueChange={(value) => onChange(index, value)}
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
