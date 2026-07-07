import { useEffect, useState } from 'react';

import { toastSuccess } from '@~/components/toastifications';
import { Button } from '@~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@~/components/ui/dialog';
import { Input } from '@~/components/ui/input';
import { Label } from '@~/components/ui/label';
import { MultiSelect } from '@~/components/ui/select';
import type { iOptionType } from '@~/components/ui/select';
import { Textarea } from '@~/components/ui/textarea';

import {
  sanitizeTemplateFieldKeys,
  TEMPLATE_FIELD_KEY_LABELS,
  TEMPLATE_FIELD_KEY_SCHEMA,
  TEMPLATE_MODES,
} from '../lib/field-templates';
import type { iCreateStoredFieldTemplateInput, TemplateFieldKey } from '../lib/field-templates';

const templateFieldKeyOptions: iOptionType[] = TEMPLATE_FIELD_KEY_SCHEMA.options.map((fieldKey) => ({
  label: TEMPLATE_FIELD_KEY_LABELS[fieldKey],
  value: fieldKey,
}));

export interface iSaveTemplateDialogProps {
  isOpen: boolean;
  initialName: string;
  initialContent: string;
  initialFieldKeys: TemplateFieldKey[];
  onOpenChange: (isOpen: boolean) => void;
  onSave: (input: iCreateStoredFieldTemplateInput) => void;
}

export function SaveTemplateDialog({
  isOpen,
  initialName,
  initialContent,
  initialFieldKeys,
  onOpenChange,
  onSave,
}: iSaveTemplateDialogProps) {
  const [name, setName] = useState(initialName);
  const [content, setContent] = useState(initialContent);
  const [fieldKeys, setFieldKeys] = useState<TemplateFieldKey[]>(initialFieldKeys);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setContent(initialContent);
      setFieldKeys(initialFieldKeys);
    }
  }, [initialContent, initialFieldKeys, initialName, isOpen]);

  const canSave = Boolean(name.trim()) && Boolean(content.trim()) && fieldKeys.length > 0;

  const handleSave = () => {
    onSave({
      name: name.trim(),
      // Captured text is stored as guidance; switch to strict mode in Settings > Templates after adding slots.
      mode: TEMPLATE_MODES.prompt,
      fieldKeys,
      content,
    });
    toastSuccess('Template saved', `"${name.trim()}" is available in Settings > Templates.`);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Save as template</DialogTitle>
          <DialogDescription>
            Captures this text as a reusable prompt-guidance template. You can refine it, add {'{{gen:label}}'} slots,
            or switch it to strict mode later in Settings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="save-template-name">Name</Label>
            <Input
              id="save-template-name"
              value={name}
              placeholder="e.g. Sectioned description"
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="save-template-field-keys">Applies to fields</Label>
            <MultiSelect
              inputId="save-template-field-keys"
              options={templateFieldKeyOptions}
              value={fieldKeys}
              onValueChange={(values) => setFieldKeys(sanitizeTemplateFieldKeys(values))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="save-template-content">Template content</Label>
            <Textarea
              id="save-template-content"
              rows={8}
              value={content}
              onChange={(event) => setContent(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={!canSave} onClick={handleSave}>
            Save template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
