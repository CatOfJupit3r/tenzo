import { useState } from 'react';
import {
  LuBookmarkPlus,
  LuLoaderCircle,
  LuSparkles,
  LuSquare,
  LuStepForward,
  LuUndo2,
  LuWandSparkles,
} from 'react-icons/lu';

import { Alert, AlertDescription, AlertTitle } from '@~/components/ui/alert';
import { Button } from '@~/components/ui/button';
import { Label } from '@~/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@~/components/ui/popover';
import { SingleSelect } from '@~/components/ui/select';
import type { iOptionType } from '@~/components/ui/select';
import { Switch } from '@~/components/ui/switch';
import { cn } from '@~/lib/utils';

import { TEMPLATE_MODE_LABELS } from '../lib/cards/field-templates';
import type {
  iCreateStoredFieldTemplateInput,
  iFieldTemplateViewModel,
  TemplateFieldKey,
} from '../lib/cards/field-templates';
import { MarkdownFieldEditor } from './editor/markdown-field-editor';
import { SaveTemplateDialog } from './save-template-dialog';

const NO_TEMPLATE_OPTION_VALUE = '';

export interface iFieldGenerationControlsProps {
  fieldId: string;
  label: string;
  shouldUseGeneralCharacterIdea: boolean;
  shouldShowGeneralCharacterIdeaToggle?: boolean;
  instructionValue: string;
  errorMessage?: string | null;
  hasExistingValue: boolean;
  hasRewriteBackup: boolean;
  isGenerating: boolean;
  templateOptions?: iFieldTemplateViewModel[];
  templateId?: string | null;
  isStrictTemplateSelected?: boolean;
  fieldValue?: string;
  templateFieldKey?: TemplateFieldKey | null;
  onTemplateIdChange?: (templateId: string | null) => void;
  onSaveTemplate?: (input: iCreateStoredFieldTemplateInput) => void;
  onShouldUseGeneralCharacterIdeaChange?: (value: boolean) => void;
  onInstructionChange: (value: string) => void;
  onGenerate: () => void;
  onContinue: () => void;
  onRewrite: () => void;
  onRevertRewrite: () => void;
  onCancel: () => void;
}

export function FieldGenerationControls({
  fieldId,
  label,
  shouldUseGeneralCharacterIdea,
  shouldShowGeneralCharacterIdeaToggle = true,
  instructionValue,
  errorMessage,
  hasExistingValue,
  hasRewriteBackup,
  isGenerating,
  templateOptions = [],
  templateId = null,
  isStrictTemplateSelected = false,
  fieldValue = '',
  templateFieldKey = null,
  onTemplateIdChange,
  onSaveTemplate,
  onShouldUseGeneralCharacterIdeaChange,
  onInstructionChange,
  onGenerate,
  onContinue,
  onRewrite,
  onRevertRewrite,
  onCancel,
}: iFieldGenerationControlsProps) {
  const [isSaveTemplateDialogOpen, setIsSaveTemplateDialogOpen] = useState(false);
  const instructionId = `${fieldId}-instructions`;
  const templateSelectId = `${fieldId}-template`;
  const shouldShowErrorState = Boolean(errorMessage);
  const hasTemplatePicker = Boolean(onTemplateIdChange) && templateOptions.length > 0;
  const canSaveTemplate = Boolean(onSaveTemplate) && fieldValue.trim().length > 0;

  const templateSelectOptions: iOptionType[] = [
    { label: 'None', value: NO_TEMPLATE_OPTION_VALUE, description: 'Generate without a field template.' },
    ...templateOptions.map((template) => ({
      label: template.name.trim() !== '' ? template.name : 'Untitled template',
      value: template.id,
      description: template.description.trim() !== '' ? template.description : TEMPLATE_MODE_LABELS[template.mode],
      meta: TEMPLATE_MODE_LABELS[template.mode],
    })),
  ];

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={`AI generation for ${label}`}
            title={isGenerating ? 'Generating' : 'AI Generation'}
            className={cn(shouldShowErrorState ? 'text-destructive' : null)}
          >
            {isGenerating ? <LuLoaderCircle className="size-4 animate-spin" /> : <LuSparkles className="size-4" />}
          </Button>
        </PopoverTrigger>

        <PopoverContent align="start" className="w-80 space-y-3" side="left">
          {shouldShowGeneralCharacterIdeaToggle && onShouldUseGeneralCharacterIdeaChange ? (
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
          ) : null}

          {hasTemplatePicker ? (
            <div className="space-y-1">
              <Label htmlFor={templateSelectId}>Template</Label>
              <SingleSelect
                inputId={templateSelectId}
                options={templateSelectOptions}
                value={templateId ?? NO_TEMPLATE_OPTION_VALUE}
                onValueChange={(value) =>
                  onTemplateIdChange?.(value === null || value === NO_TEMPLATE_OPTION_VALUE ? null : value)
                }
              />
              {isStrictTemplateSelected ? (
                <p className="text-xs text-muted-foreground">
                  Strict template: the AI only fills the slots, so Continue is unavailable.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-1">
            <Label htmlFor={instructionId}>AI instructions for {label}</Label>
            <MarkdownFieldEditor
              fieldId={instructionId}
              rows={3}
              value={instructionValue}
              placeholder="Optional guidance for this field"
              doesHighlightTemplateSlots
              onValueChange={onInstructionChange}
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
              disabled={isGenerating || !hasExistingValue || isStrictTemplateSelected}
              onClick={onContinue}
            >
              <LuStepForward className="size-4" />
              Continue
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isGenerating || !hasExistingValue}
              onClick={onRewrite}
            >
              <LuWandSparkles className="size-4" />
              Rewrite
            </Button>
            {hasRewriteBackup ? (
              <Button type="button" size="sm" variant="outline" disabled={isGenerating} onClick={onRevertRewrite}>
                <LuUndo2 className="size-4" />
                Revert rewrite
              </Button>
            ) : null}
            <Button type="button" size="sm" variant="ghost" disabled={!isGenerating} onClick={onCancel}>
              <LuSquare className="size-4" />
              Cancel
            </Button>
            {canSaveTemplate ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={isGenerating}
                onClick={() => setIsSaveTemplateDialogOpen(true)}
              >
                <LuBookmarkPlus className="size-4" />
                Save as template
              </Button>
            ) : null}
          </div>

          {errorMessage ? (
            <Alert variant="destructive">
              <AlertTitle>Generation failed</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}
        </PopoverContent>
      </Popover>

      {onSaveTemplate ? (
        <SaveTemplateDialog
          isOpen={isSaveTemplateDialogOpen}
          initialName={`${label} template`}
          initialContent={fieldValue}
          initialFieldKeys={templateFieldKey ? [templateFieldKey] : []}
          onOpenChange={setIsSaveTemplateDialogOpen}
          onSave={onSaveTemplate}
        />
      ) : null}
    </>
  );
}
