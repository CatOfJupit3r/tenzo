import { useEffect, useState } from 'react';
import type { ChangeEvent, FocusEvent } from 'react';

import { Input } from '@~/components/ui/input';
import { Label } from '@~/components/ui/label';

export interface iTagsInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
}

export function TagsInput({ value, onChange }: iTagsInputProps) {
  const [draft, setDraft] = useState(value.join(', '));

  useEffect(() => {
    setDraft(value.join(', '));
  }, [value]);

  const commit = (event: FocusEvent<HTMLInputElement>) => {
    const tags = event.target.value
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
    onChange(tags);
  };

  return (
    <div className="space-y-1.5">
      <Label htmlFor="character-tags">Tags</Label>
      <Input
        id="character-tags"
        value={draft}
        onChange={(event: ChangeEvent<HTMLInputElement>) => setDraft(event.target.value)}
        onBlur={commit}
        placeholder="fantasy, companion, slow-burn"
      />
      <p className="text-sm text-muted-foreground">Comma-separated. Used for sorting and filtering, not prompts.</p>
    </div>
  );
}
