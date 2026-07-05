import type { ChangeEvent } from 'react';

import { Input } from '@~/components/ui/input';
import { Label } from '@~/components/ui/label';
import { Textarea } from '@~/components/ui/textarea';

export interface iCharacterFieldProps {
  fieldId: string;
  label: string;
  value: string;
  rows?: number;
  hint?: string;
  onValueChange: (value: string) => void;
}

export function CharacterField({ fieldId, label, value, rows = 4, hint, onValueChange }: iCharacterFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={fieldId}>{label}</Label>
      {rows <= 1 ? (
        <Input
          id={fieldId}
          value={value}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onValueChange(event.target.value)}
        />
      ) : (
        <Textarea
          id={fieldId}
          value={value}
          rows={rows}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onValueChange(event.target.value)}
        />
      )}
      {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
