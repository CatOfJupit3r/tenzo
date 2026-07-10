import { useEffect, useState } from 'react';
import type { ChangeEvent, FocusEvent } from 'react';
import { LuSparkles } from 'react-icons/lu';

import { Button } from '@~/components/ui/button';
import { Input } from '@~/components/ui/input';
import { Label } from '@~/components/ui/label';

export interface iTagsInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  onAskAssistant?: () => void;
}

export function TagsInput({ value, onChange, onAskAssistant }: iTagsInputProps) {
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
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="character-tags">Tags</Label>
        {onAskAssistant ? (
          <Button type="button" size="sm" variant="ghost" onClick={onAskAssistant}>
            <LuSparkles className="size-3.5" />
            Ask AI
          </Button>
        ) : null}
      </div>
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
