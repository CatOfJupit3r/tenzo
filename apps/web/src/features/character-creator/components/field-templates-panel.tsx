import { useState } from 'react';
import { LuCopy, LuLock, LuPlus, LuTrash2 } from 'react-icons/lu';

import { Alert, AlertDescription, AlertTitle } from '@~/components/ui/alert';
import { Badge } from '@~/components/ui/badge';
import { Button } from '@~/components/ui/button';
import { Input } from '@~/components/ui/input';
import { Label } from '@~/components/ui/label';
import { MultiSelect, SingleSelect } from '@~/components/ui/select';
import type { iOptionType } from '@~/components/ui/select';
import { cn } from '@~/lib/utils';

import type { FieldTemplatePatch } from '../hooks/use-field-templates';
import {
  parseTemplateSlots,
  TEMPLATE_FIELD_KEY_LABELS,
  TEMPLATE_FIELD_KEY_SCHEMA,
  TEMPLATE_FIELD_KEYS_ALLOWING_ORIGINAL_MACRO,
  TEMPLATE_MODE_LABELS,
  TEMPLATE_MODES,
  validateFieldTemplate,
} from '../lib/field-templates';
import type { iFieldTemplateViewModel, TemplateMode, iCreateStoredFieldTemplateInput } from '../lib/field-templates';
import { MarkdownFieldEditor } from './editor/markdown-field-editor';

const templateModeOptions: iOptionType[] = [
  {
    label: TEMPLATE_MODE_LABELS[TEMPLATE_MODES.prompt],
    value: TEMPLATE_MODES.prompt,
    description: 'The AI receives the template as structural guidance and writes the whole field freely.',
  },
  {
    label: TEMPLATE_MODE_LABELS[TEMPLATE_MODES.strict],
    value: TEMPLATE_MODES.strict,
    description: 'The template is a fixed skeleton; the AI only fills the {{gen:label}} slots.',
  },
];

const templateFieldKeyOptions: iOptionType[] = TEMPLATE_FIELD_KEY_SCHEMA.options.map((fieldKey) => ({
  label: TEMPLATE_FIELD_KEY_LABELS[fieldKey],
  value: fieldKey,
}));

export interface iFieldTemplatesPanelProps {
  fieldTemplates: iFieldTemplateViewModel[];
  onAddTemplate: (input: iCreateStoredFieldTemplateInput) => string;
  onUpdateTemplate: (id: string, patch: FieldTemplatePatch) => void;
  onRemoveTemplate: (id: string) => void;
  onDuplicateTemplate: (id: string) => string | null;
}

export function FieldTemplatesPanel({
  fieldTemplates,
  onAddTemplate,
  onUpdateTemplate,
  onRemoveTemplate,
  onDuplicateTemplate,
}: iFieldTemplatesPanelProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(fieldTemplates[0]?.id ?? null);
  const selectedTemplate = fieldTemplates.find((template) => template.id === selectedTemplateId) ?? null;
  const validationIssues = selectedTemplate ? validateFieldTemplate(selectedTemplate) : [];
  const templateSlots = selectedTemplate ? parseTemplateSlots(selectedTemplate.content) : [];
  const hasOriginalMacroCapableField = Boolean(
    selectedTemplate?.fieldKeys.some((fieldKey) => TEMPLATE_FIELD_KEYS_ALLOWING_ORIGINAL_MACRO.includes(fieldKey)),
  );

  const handleCreateTemplate = () => {
    const newTemplateId = onAddTemplate({
      name: 'New template',
      mode: TEMPLATE_MODES.prompt,
      fieldKeys: [],
      content: '',
    });
    setSelectedTemplateId(newTemplateId);
  };

  const handleDuplicateTemplate = (id: string) => {
    const duplicatedTemplateId = onDuplicateTemplate(id);

    if (duplicatedTemplateId) {
      setSelectedTemplateId(duplicatedTemplateId);
    }
  };

  const handleRemoveTemplate = (id: string) => {
    onRemoveTemplate(id);

    if (selectedTemplateId === id) {
      setSelectedTemplateId(fieldTemplates.find((template) => template.id !== id)?.id ?? null);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
      <div className="space-y-2">
        <Button type="button" size="sm" variant="outline" className="w-full" onClick={handleCreateTemplate}>
          <LuPlus className="size-4" />
          New template
        </Button>

        <div className="max-h-[55vh] space-y-1 overflow-y-auto pr-1" role="listbox" aria-label="Field templates">
          {fieldTemplates.map((template) => (
            <button
              key={template.id}
              type="button"
              role="option"
              aria-selected={template.id === selectedTemplateId}
              className={cn(
                'w-full rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60',
                template.id === selectedTemplateId ? 'border-ring bg-muted/60' : 'border-transparent',
              )}
              onClick={() => setSelectedTemplateId(template.id)}
            >
              <span className="flex items-center gap-1.5">
                <span className="min-w-0 flex-1 truncate font-medium">{template.name || 'Untitled template'}</span>
                {template.isBuiltIn ? <LuLock aria-label="Built-in template" className="size-3 shrink-0" /> : null}
              </span>
              <span className="mt-1 flex flex-wrap gap-1">
                <Badge variant="secondary">{TEMPLATE_MODE_LABELS[template.mode]}</Badge>
                {template.fieldKeys.slice(0, 2).map((fieldKey) => (
                  <Badge key={fieldKey} variant="outline">
                    {TEMPLATE_FIELD_KEY_LABELS[fieldKey]}
                  </Badge>
                ))}
                {template.fieldKeys.length > 2 ? (
                  <Badge variant="outline">+{template.fieldKeys.length - 2}</Badge>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      </div>

      {selectedTemplate ? (
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {selectedTemplate.isBuiltIn ? (
                <Badge variant="secondary">
                  <LuLock className="size-3" />
                  Built-in — duplicate to edit
                </Badge>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleDuplicateTemplate(selectedTemplate.id)}
              >
                <LuCopy className="size-4" />
                Duplicate
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={selectedTemplate.isBuiltIn}
                onClick={() => handleRemoveTemplate(selectedTemplate.id)}
              >
                <LuTrash2 className="size-4" />
                Delete
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="template-name">Name</Label>
              <Input
                id="template-name"
                value={selectedTemplate.name}
                disabled={selectedTemplate.isBuiltIn}
                onChange={(event) => onUpdateTemplate(selectedTemplate.id, { name: event.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="template-mode">Mode</Label>
              <SingleSelect
                inputId="template-mode"
                options={templateModeOptions}
                value={selectedTemplate.mode}
                isDisabled={selectedTemplate.isBuiltIn}
                onValueChange={(value) => {
                  if (value) {
                    onUpdateTemplate(selectedTemplate.id, { mode: value as TemplateMode });
                  }
                }}
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="template-field-keys">Applies to fields</Label>
              <MultiSelect
                inputId="template-field-keys"
                options={templateFieldKeyOptions}
                value={selectedTemplate.fieldKeys}
                isDisabled={selectedTemplate.isBuiltIn}
                onValueChange={(values) =>
                  onUpdateTemplate(selectedTemplate.id, {
                    fieldKeys: values.filter(
                      (value): value is (typeof selectedTemplate.fieldKeys)[number] =>
                        TEMPLATE_FIELD_KEY_SCHEMA.safeParse(value).success,
                    ),
                  })
                }
              />
              <p className="text-sm text-muted-foreground">
                The template is offered in the AI Generation popover of every bound field.
              </p>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="template-description">Notes</Label>
              <Input
                id="template-description"
                placeholder="Optional short description"
                value={selectedTemplate.description}
                disabled={selectedTemplate.isBuiltIn}
                onChange={(event) => onUpdateTemplate(selectedTemplate.id, { description: event.target.value })}
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="template-content">Template content</Label>
              <MarkdownFieldEditor
                fieldId="template-content"
                value={selectedTemplate.content}
                rows={10}
                placeholder={
                  selectedTemplate.mode === TEMPLATE_MODES.strict
                    ? 'Fixed skeleton text with {{gen:label}} or {{gen:label:hint}} slots for the AI to fill.'
                    : 'Structure, sections, and style notes the AI should follow for this field.'
                }
                isReadOnly={selectedTemplate.isBuiltIn}
                doesAllowOriginalMacro={hasOriginalMacroCapableField}
                doesHighlightTemplateSlots
                onValueChange={(value) => onUpdateTemplate(selectedTemplate.id, { content: value })}
              />
              {selectedTemplate.mode === TEMPLATE_MODES.strict ? (
                <p className="text-sm text-muted-foreground">
                  {templateSlots.length > 0
                    ? `Detected slots: ${templateSlots.map((slot) => slot.label).join(', ')}`
                    : 'No {{gen:label}} slots detected yet.'}
                </p>
              ) : null}
            </div>
          </div>

          {validationIssues.length > 0 ? (
            <Alert variant="destructive">
              <AlertTitle>Template needs attention</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-4">
                  {validationIssues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}
        </div>
      ) : (
        <div className="flex min-h-48 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          Create a template to define a reusable structure for a field.
        </div>
      )}
    </div>
  );
}
