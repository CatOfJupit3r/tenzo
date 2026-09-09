import { Badge } from '@~/components/ui/badge';
import { Button } from '@~/components/ui/button';
import { BADGE_VARIANTS, BUTTON_SIZES, BUTTON_VARIANTS } from '@~/components/ui/ui-enums';
import type { RewriteSide } from '@~/features/character-creator/lib/editor/editor-enums';
import { REWRITE_SIDES } from '@~/features/character-creator/lib/editor/editor-enums';
import {
  CHARACTER_EDIT_PATCH_KINDS_CASES,
  CHARACTER_EDIT_PATCH_STATUSES,
} from '@~/features/character-creator/lib/proposals/character-edit-proposal';

import type { iCharacterEditPatch } from '../lib/proposals/character-edit-proposal';

interface iCharacterAssistantStructuredReviewProps {
  patch: Exclude<iCharacterEditPatch, { kind: typeof CHARACTER_EDIT_PATCH_KINDS_CASES.TEXT }>;
  onApply: () => void;
  onReject: () => void;
}

function renderValues(patch: iCharacterAssistantStructuredReviewProps['patch'], side: RewriteSide) {
  if (patch.kind === CHARACTER_EDIT_PATCH_KINDS_CASES.STRING_LIST) {
    const values = side === REWRITE_SIDES.OLD ? patch.oldValue : patch.newValue;
    return values.length > 0 ? values.map((value) => <li key={value}>{value}</li>) : <li>None</li>;
  }

  if (patch.kind === CHARACTER_EDIT_PATCH_KINDS_CASES.CHARACTER_BOOK) {
    const characterBook = side === REWRITE_SIDES.OLD ? patch.oldValue : patch.newValue;
    return characterBook ? (
      <li>
        <span className="font-medium">{characterBook.name ?? 'Untitled book'}</span>
        <span className="block text-muted-foreground">
          {characterBook.entries.length} {characterBook.entries.length === 1 ? 'entry' : 'entries'}
        </span>
      </li>
    ) : (
      <li>No character book</li>
    );
  }

  const values = side === REWRITE_SIDES.OLD ? patch.oldValue : patch.newValue;
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
          {patch.status === CHARACTER_EDIT_PATCH_STATUSES.CONFLICT ? (
            <Badge variant={BADGE_VARIANTS.DESTRUCTIVE}>Needs review</Badge>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button type="button" size={BUTTON_SIZES.SM} variant={BUTTON_VARIANTS.OUTLINE} onClick={onReject}>
            Reject
          </Button>
          <Button type="button" size={BUTTON_SIZES.SM} onClick={onApply}>
            Apply
          </Button>
        </div>
      </div>
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-lg border bg-background/70 p-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase">Current</p>
          <ul className="grid gap-1 whitespace-pre-wrap">{renderValues(patch, REWRITE_SIDES.OLD)}</ul>
        </div>
        <div className="rounded-lg border border-primary/25 bg-background p-3">
          <p className="mb-2 text-xs font-semibold text-primary uppercase">Proposed</p>
          <ul className="grid gap-1 whitespace-pre-wrap">{renderValues(patch, REWRITE_SIDES.NEW)}</ul>
        </div>
      </div>
    </div>
  );
}
