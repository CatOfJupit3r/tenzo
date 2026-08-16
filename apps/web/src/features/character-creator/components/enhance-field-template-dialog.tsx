import { useEffect, useState } from 'react';
import { LuArrowLeft, LuLoaderCircle, LuRefreshCw, LuSparkles } from 'react-icons/lu';

import { toastSuccess } from '@~/components/toastifications';
import { Alert, AlertDescription, AlertTitle } from '@~/components/ui/alert';
import { Badge } from '@~/components/ui/badge';
import { Button } from '@~/components/ui/button';
import { Checkbox } from '@~/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@~/components/ui/dialog';
import { Label } from '@~/components/ui/label';
import { MultiSelect } from '@~/components/ui/select';
import type { iOptionType } from '@~/components/ui/select';
import { Textarea } from '@~/components/ui/textarea';
import { cn } from '@~/lib/utils';

import type { iEnhanceTemplateOptions } from '../hooks/use-template-enhancement';
import {
  EXAMPLE_CHARACTER_CONTEXT_FIELD_KEYS,
  EXAMPLE_CHARACTER_CONTEXT_FIELD_LABELS,
  getExampleCharacterDisplayName,
  hasExampleCharacterContextField,
  toPromptExampleCharacter,
} from '../lib/cards/example-characters';
import type { ExampleCharacterContextFieldKey, iStoredExampleCharacter } from '../lib/cards/example-characters';
import { parseTemplateSlots, TEMPLATE_MODES } from '../lib/cards/field-templates';
import type { iFieldTemplateViewModel } from '../lib/cards/field-templates';
import { MAX_TEMPLATE_ENHANCEMENT_REFERENCE_COUNT } from '../lib/templates/template-enhancement';
import { MarkdownFieldEditor } from './editor/markdown-field-editor';

export interface iEnhanceFieldTemplateDialogProps {
  isOpen: boolean;
  isEnhancing: boolean;
  targetTemplate: iFieldTemplateViewModel;
  fieldTemplates: iFieldTemplateViewModel[];
  exampleCharacters: iStoredExampleCharacter[];
  onOpenChange: (isOpen: boolean) => void;
  onCancel: () => void;
  onEnhance: (options: iEnhanceTemplateOptions) => Promise<string>;
  onApply: (content: string) => void;
}

export function EnhanceFieldTemplateDialog({
  isOpen,
  isEnhancing,
  targetTemplate,
  fieldTemplates,
  exampleCharacters,
  onOpenChange,
  onCancel,
  onEnhance,
  onApply,
}: iEnhanceFieldTemplateDialogProps) {
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [shouldIncludeCurrentTemplate, setShouldIncludeCurrentTemplate] = useState(true);
  const [selectedExampleFieldKeys, setSelectedExampleFieldKeys] = useState<
    Record<string, ExampleCharacterContextFieldKey[]>
  >({});
  const [guidance, setGuidance] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [candidateContent, setCandidateContent] = useState<string | null>(null);
  const templateOptions: iOptionType[] = fieldTemplates
    .filter((template) => template.id !== targetTemplate.id)
    .map((template) => ({
      label: template.name || 'Untitled template',
      value: template.id,
      description: template.description || undefined,
    }));

  useEffect(() => {
    if (isOpen) {
      setSelectedTemplateIds([]);
      setShouldIncludeCurrentTemplate(true);
      setSelectedExampleFieldKeys({});
      setGuidance('');
      setErrorMessage(null);
      setCandidateContent(null);
    }
  }, [isOpen, targetTemplate.id]);

  const handleOpenChange = (nextIsOpen: boolean) => {
    if (!nextIsOpen && isEnhancing) {
      onCancel();
    }

    onOpenChange(nextIsOpen);
  };

  const handleEnhance = async () => {
    setErrorMessage(null);

    try {
      const enhancedContent = await onEnhance({
        targetTemplate: candidateContent === null ? targetTemplate : { ...targetTemplate, content: candidateContent },
        shouldIncludeCurrentTemplate,
        referenceTemplates: selectedTemplateIds.flatMap((templateId) => {
          const template = fieldTemplates.find((candidate) => candidate.id === templateId);
          return template ? [template] : [];
        }),
        exampleCharacters: exampleCharacters.flatMap((exampleCharacter) => {
          const includedFieldKeys = selectedExampleFieldKeys[exampleCharacter.id] ?? [];
          return includedFieldKeys.length > 0
            ? [toPromptExampleCharacter({ ...exampleCharacter, includedFieldKeys })]
            : [];
        }),
        guidance,
      });

      if (targetTemplate.mode === TEMPLATE_MODES.strict && parseTemplateSlots(enhancedContent).length === 0) {
        throw new Error('The enhanced strict template did not contain any {{gen:label}} slots.');
      }

      setCandidateContent(enhancedContent);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }

      setErrorMessage(error instanceof Error ? error.message : 'Template enhancement failed.');
    }
  };

  const handleApply = () => {
    if (candidateContent === null) {
      return;
    }

    if (targetTemplate.mode === TEMPLATE_MODES.strict && parseTemplateSlots(candidateContent).length === 0) {
      setErrorMessage('The enhanced strict template needs at least one {{gen:label}} slot before it can be applied.');
      return;
    }

    onApply(candidateContent);
    toastSuccess('Template enhanced', `AI updated "${targetTemplate.name || 'Untitled template'}".`);
    onOpenChange(false);
  };

  const isReviewing = candidateContent !== null;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className={isReviewing ? 'sm:max-w-5xl' : 'sm:max-w-2xl'}>
        <DialogHeader>
          <DialogTitle>Enhance with AI</DialogTitle>
          <DialogDescription>
            {isReviewing
              ? 'Compare the original with the editable AI draft, then apply only when it is ready.'
              : `Regenerate ${targetTemplate.name || 'this template'} using selected references and your guidance.`}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
          {isReviewing ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="min-w-0 space-y-1.5">
                <Label id="original-template-content-label" htmlFor="original-template-content">
                  Current template
                </Label>
                <MarkdownFieldEditor
                  fieldId="original-template-content"
                  value={targetTemplate.content}
                  rows={12}
                  isReadOnly
                  doesHighlightTemplateSlots
                  ariaLabelledBy="original-template-content-label"
                  onValueChange={() => undefined}
                />
              </div>

              <div className="min-w-0 space-y-1.5">
                <Label id="candidate-template-content-label" htmlFor="candidate-template-content">
                  AI draft
                </Label>
                <MarkdownFieldEditor
                  fieldId="candidate-template-content"
                  value={candidateContent}
                  rows={12}
                  isReadOnly={isEnhancing}
                  isStreaming={isEnhancing}
                  doesHighlightTemplateSlots
                  ariaLabelledBy="candidate-template-content-label"
                  onValueChange={setCandidateContent}
                />
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Reference example parts</p>
                {exampleCharacters.length > 0 ? (
                  <div className="max-h-72 space-y-3 overflow-y-auto rounded-md border p-3">
                    {exampleCharacters.map((exampleCharacter) => {
                      const displayName = getExampleCharacterDisplayName(exampleCharacter);
                      const availableFieldKeys = EXAMPLE_CHARACTER_CONTEXT_FIELD_KEYS.filter((fieldKey) =>
                        hasExampleCharacterContextField(exampleCharacter, fieldKey),
                      );
                      const includedFieldKeys = selectedExampleFieldKeys[exampleCharacter.id] ?? [];
                      const hasSelectedAll =
                        availableFieldKeys.length > 0 &&
                        availableFieldKeys.every((fieldKey) => includedFieldKeys.includes(fieldKey));

                      return (
                        <div key={exampleCharacter.id} className="space-y-3 rounded-md border bg-muted/20 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="min-w-0 space-y-1">
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="truncate text-sm font-medium">{displayName}</span>
                                <Badge variant="outline">{exampleCharacter.sourceKind.toUpperCase()}</Badge>
                              </div>
                              <p className="truncate text-sm text-muted-foreground">{exampleCharacter.fileName}</p>
                            </div>
                            <Label
                              htmlFor={`enhance-example-${exampleCharacter.id}-all`}
                              className="flex items-center gap-2 text-sm"
                            >
                              <Checkbox
                                id={`enhance-example-${exampleCharacter.id}-all`}
                                checked={hasSelectedAll}
                                disabled={isEnhancing || availableFieldKeys.length === 0}
                                onCheckedChange={(checked) =>
                                  setSelectedExampleFieldKeys((currentSelections) => ({
                                    ...currentSelections,
                                    [exampleCharacter.id]: checked === true ? availableFieldKeys : [],
                                  }))
                                }
                              />
                              Select all
                            </Label>
                          </div>

                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                            {EXAMPLE_CHARACTER_CONTEXT_FIELD_KEYS.map((fieldKey) => {
                              const checkboxId = `enhance-example-${exampleCharacter.id}-${fieldKey}`;
                              const hasField = availableFieldKeys.includes(fieldKey);
                              const isChecked = includedFieldKeys.includes(fieldKey);

                              return (
                                <Label
                                  key={fieldKey}
                                  htmlFor={checkboxId}
                                  className={cn(
                                    'flex items-center gap-2 rounded-md border px-2.5 py-2 text-sm',
                                    !hasField && 'opacity-50',
                                  )}
                                >
                                  <Checkbox
                                    id={checkboxId}
                                    checked={hasField ? isChecked : undefined}
                                    disabled={isEnhancing || !hasField}
                                    onCheckedChange={(checked) =>
                                      setSelectedExampleFieldKeys((currentSelections) => {
                                        const currentFieldKeys = currentSelections[exampleCharacter.id] ?? [];
                                        return {
                                          ...currentSelections,
                                          [exampleCharacter.id]:
                                            checked === true
                                              ? [...new Set([...currentFieldKeys, fieldKey])]
                                              : currentFieldKeys.filter((key) => key !== fieldKey),
                                        };
                                      })
                                    }
                                  />
                                  <span>{EXAMPLE_CHARACTER_CONTEXT_FIELD_LABELS[fieldKey]}</span>
                                </Label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    No reference examples saved.
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  Choose only the character parts that should influence this template draft.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="enhance-template-current-content" className="flex items-center gap-2">
                  <Checkbox
                    id="enhance-template-current-content"
                    checked={shouldIncludeCurrentTemplate}
                    disabled={isEnhancing}
                    onCheckedChange={(checked) => setShouldIncludeCurrentTemplate(checked === true)}
                  />
                  Include current template content
                </Label>
                <p className="text-sm text-muted-foreground">
                  Turn this off to create the draft from guidance and selected references without sending the current
                  content.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="enhance-template-references">Other templates</Label>
                <MultiSelect
                  inputId="enhance-template-references"
                  options={templateOptions}
                  value={selectedTemplateIds}
                  isDisabled={isEnhancing || templateOptions.length === 0}
                  placeholder={
                    templateOptions.length === 0 ? 'No other templates available' : 'Select reusable templates'
                  }
                  onValueChange={(values) =>
                    setSelectedTemplateIds(values.slice(0, MAX_TEMPLATE_ENHANCEMENT_REFERENCE_COUNT))
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Choose up to {MAX_TEMPLATE_ENHANCEMENT_REFERENCE_COUNT} templates as structural or stylistic
                  references.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="enhance-template-guidance">Guidance</Label>
                <Textarea
                  id="enhance-template-guidance"
                  value={guidance}
                  rows={4}
                  maxLength={2_000}
                  disabled={isEnhancing}
                  placeholder="e.g. Add clearer sections, stronger sensory detail, and concise slot hints."
                  onChange={(event) => setGuidance(event.target.value)}
                />
              </div>
            </>
          )}

          {errorMessage ? (
            <Alert variant="destructive">
              <AlertTitle>Enhancement failed</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DialogFooter>
          {isReviewing ? (
            <>
              <Button type="button" variant="ghost" disabled={isEnhancing} onClick={() => handleOpenChange(false)}>
                Discard
              </Button>
              <Button type="button" variant="outline" disabled={isEnhancing} onClick={() => setCandidateContent(null)}>
                <LuArrowLeft className="size-4" />
                Edit guidance
              </Button>
              <Button type="button" variant="outline" disabled={isEnhancing} onClick={handleEnhance}>
                {isEnhancing ? <LuLoaderCircle className="size-4 animate-spin" /> : <LuRefreshCw className="size-4" />}
                {isEnhancing ? 'Regenerating' : 'Regenerate'}
              </Button>
              <Button type="button" disabled={isEnhancing} onClick={handleApply}>
                Apply changes
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" disabled={isEnhancing} onClick={handleEnhance}>
                {isEnhancing ? <LuLoaderCircle className="size-4 animate-spin" /> : <LuSparkles className="size-4" />}
                {isEnhancing ? 'Enhancing' : 'Generate draft'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
