import { Badge } from '@~/components/ui/badge';
import { Button } from '@~/components/ui/button';

import { CHARACTER_EDIT_PATCH_STATUSES } from '../lib/character-edit-proposal';
import type { iCharacterEditPatch } from '../lib/character-edit-proposal';

interface iCharacterAssistantStructuredReviewProps {
  patch: Exclude<iCharacterEditPatch, { kind: 'text' } | { kind: 'character-book' }>;
  onApply: () => void;
  onReject: () => void;
}

function renderValues(patch: iCharacterAssistantStructuredReviewProps['patch'], side: 'old' | 'new') {
  if (patch.kind === 'string-list') {
    const values = side === 'old' ? patch.oldValue : patch.newValue;
    return values.length > 0 ? values.map((value) => <li key={value}>{value}</li>) : <li>None</li>;
  }

  const values = side === 'old' ? patch.oldValue : patch.newValue;
  return values.length > 0 ? (
    values.map((field) => (
      <li key={field.id}>
        <span className="font-medium">{field.label || 'Untitled'}:</span> {field.value || 'Empty'}
      </li>
    ))
  ) : (
    <li>None</li>
  );
}

export function CharacterAssistantStructuredReview({
  patch,
  onApply,
  onReject,
}: iCharacterAssistantStructuredReviewProps) {
  return (
    <div className="grid gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge>AI proposal</Badge>
          {patch.status === CHARACTER_EDIT_PATCH_STATUSES.conflict ? (
            <Badge variant="destructive">Needs review</Badge>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onReject}>
            Reject
          </Button>
          <Button type="button" size="sm" onClick={onApply}>
            Apply
          </Button>
        </div>
      </div>
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-lg border bg-background/70 p-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase">Current</p>
          <ul className="grid gap-1 whitespace-pre-wrap">{renderValues(patch, 'old')}</ul>
        </div>
        <div className="rounded-lg border border-primary/25 bg-background p-3">
          <p className="mb-2 text-xs font-semibold text-primary uppercase">Proposed</p>
          <ul className="grid gap-1 whitespace-pre-wrap">{renderValues(patch, 'new')}</ul>
        </div>
      </div>
    </div>
  );
}
