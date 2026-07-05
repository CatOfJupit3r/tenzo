import type { ChangeEvent } from 'react';
import { LuPlus, LuTrash2 } from 'react-icons/lu';

import { Button } from '@~/components/ui/button';
import { Input } from '@~/components/ui/input';
import { Textarea } from '@~/components/ui/textarea';

import type { CustomField } from '../lib/card-schema';
import { FieldGenerationControls } from './field-generation-controls';

interface iCustomFieldGenerationState {
  instructionValue: string;
  errorMessage?: string | null;
  isGenerating: boolean;
}

export interface iCustomFieldsProps {
  fields: CustomField[];
  generationStates: Record<string, iCustomFieldGenerationState>;
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<Pick<CustomField, 'label' | 'value'>>) => void;
  onRemove: (id: string) => void;
  onInstructionChange: (id: string, value: string) => void;
  onGenerate: (id: string) => void;
  onContinue: (id: string) => void;
  onCancel: (id: string) => void;
}

export function CustomFields({
  fields,
  generationStates,
  onAdd,
  onUpdate,
  onRemove,
  onInstructionChange,
  onGenerate,
  onContinue,
  onCancel,
}: iCustomFieldsProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm leading-none font-medium">Custom Fields</span>
        <Button type="button" variant="outline" size="sm" onClick={onAdd}>
          <LuPlus className="size-4" />
          Add field
        </Button>
      </div>

      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">No custom fields yet.</p>
      ) : (
        <div className="space-y-3">
          {fields.map((field) => (
            <div key={field.id} className="space-y-3 rounded-md border p-3">
              <div className="flex items-start gap-2">
                <Input
                  aria-label="Custom field name"
                  placeholder="Field name"
                  value={field.label}
                  className="w-52 shrink-0"
                  onChange={(event: ChangeEvent<HTMLInputElement>) => onUpdate(field.id, { label: event.target.value })}
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
                instructionValue={generationStates[field.id]?.instructionValue ?? ''}
                errorMessage={generationStates[field.id]?.errorMessage ?? null}
                hasExistingValue={field.value.trim().length > 0}
                isGenerating={generationStates[field.id]?.isGenerating ?? false}
                onInstructionChange={(value) => onInstructionChange(field.id, value)}
                onGenerate={() => onGenerate(field.id)}
                onContinue={() => onContinue(field.id)}
                onCancel={() => onCancel(field.id)}
              />

              <Textarea
                aria-label="Custom field value"
                placeholder="Value"
                value={field.value}
                rows={3}
                className="flex-1"
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                  onUpdate(field.id, { value: event.target.value })
                }
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
