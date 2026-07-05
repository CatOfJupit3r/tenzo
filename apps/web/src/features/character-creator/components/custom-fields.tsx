import type { ChangeEvent } from 'react';
import { LuPlus, LuTrash2 } from 'react-icons/lu';

import { Button } from '@~/components/ui/button';
import { Input } from '@~/components/ui/input';

import type { CustomField } from '../lib/card-schema';

export interface iCustomFieldsProps {
  fields: CustomField[];
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<Pick<CustomField, 'label' | 'value'>>) => void;
  onRemove: (id: string) => void;
}

export function CustomFields({ fields, onAdd, onUpdate, onRemove }: iCustomFieldsProps) {
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
        <div className="space-y-2">
          {fields.map((field) => (
            <div key={field.id} className="flex gap-2">
              <Input
                aria-label="Custom field name"
                placeholder="Field name"
                value={field.label}
                className="w-40 shrink-0"
                onChange={(event: ChangeEvent<HTMLInputElement>) => onUpdate(field.id, { label: event.target.value })}
              />
              <Input
                aria-label="Custom field value"
                placeholder="Value"
                value={field.value}
                className="flex-1"
                onChange={(event: ChangeEvent<HTMLInputElement>) => onUpdate(field.id, { value: event.target.value })}
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
          ))}
        </div>
      )}
    </div>
  );
}
