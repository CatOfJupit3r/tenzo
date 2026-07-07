import { diffArrays, diffWordsWithSpace } from 'diff';
import { useMemo } from 'react';

import { Badge } from '@~/components/ui/badge';
import { Checkbox } from '@~/components/ui/checkbox';
import { cn } from '@~/lib/utils';

import type { CharacterCardChangedFieldKey, iCharacterCardFieldDiff } from '../lib/character-card-diff';

interface iCharacterAgentDraftDiffProps {
  diffs: iCharacterCardFieldDiff[];
  selectedFieldKeys: ReadonlySet<CharacterCardChangedFieldKey>;
  onToggleField: (fieldKey: CharacterCardChangedFieldKey) => void;
}

function WordDiffText({ oldValue, newValue }: { oldValue: string; newValue: string }) {
  const parts = useMemo(() => diffWordsWithSpace(oldValue, newValue), [oldValue, newValue]);

  return (
    <>
      {parts.map((part, index) => (
        <span
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          className={cn(part.added && 'bg-chart-2/25', part.removed && 'bg-destructive/25 line-through opacity-70')}
        >
          {part.value}
        </span>
      ))}
    </>
  );
}

function TextFieldDiff({ oldValue, newValue }: { oldValue: string; newValue: string }) {
  if (!oldValue.trim()) {
    return <p className="whitespace-pre-wrap text-chart-2">{newValue || '(empty)'}</p>;
  }

  if (!newValue.trim()) {
    return <p className="whitespace-pre-wrap text-destructive line-through opacity-70">{oldValue}</p>;
  }

  return (
    <p className="whitespace-pre-wrap">
      <WordDiffText oldValue={oldValue} newValue={newValue} />
    </p>
  );
}

function ListFieldDiff({ oldValue, newValue }: { oldValue: string[]; newValue: string[] }) {
  const listChanges = useMemo(() => diffArrays(oldValue, newValue), [oldValue, newValue]);

  return (
    <div className="flex flex-wrap gap-1.5">
      {listChanges.flatMap((change) =>
        change.value.map((item, itemIndex) => (
          <Badge
            // eslint-disable-next-line react/no-array-index-key, no-nested-ternary
            key={`${change.added ? 'added' : change.removed ? 'removed' : 'kept'}-${itemIndex}-${item}`}
            variant="outline"
            className={cn(
              change.added && 'border-chart-2/50 bg-chart-2/10 text-foreground',
              change.removed && 'border-destructive/50 bg-destructive/10 text-muted-foreground line-through',
            )}
          >
            {item || '(empty)'}
          </Badge>
        )),
      )}
    </div>
  );
}

interface iCustomField {
  id: string;
  label: string;
  value: string;
}

function CustomFieldsDiff({ oldValue, newValue }: { oldValue: iCustomField[]; newValue: iCustomField[] }) {
  const rows = useMemo(() => {
    const oldById = new Map(oldValue.map((field) => [field.id, field]));
    const newById = new Map(newValue.map((field) => [field.id, field]));
    const orderedIds = [...new Set([...oldValue.map((field) => field.id), ...newValue.map((field) => field.id)])];

    return orderedIds
      .map((id) => ({ id, oldField: oldById.get(id) ?? null, newField: newById.get(id) ?? null }))
      .filter(({ oldField, newField }) => {
        if (!oldField || !newField) {
          return true;
        }
        return oldField.label !== newField.label || oldField.value !== newField.value;
      });
  }, [newValue, oldValue]);

  return (
    <div className="grid gap-3">
      {rows.map(({ id, oldField, newField }) => (
        <div key={id} className="rounded-lg border bg-muted/20 p-2">
          {
            // eslint-disable-next-line no-nested-ternary
            !oldField ? (
              <div className="text-sm">
                <span className="font-medium text-chart-2">+ {newField?.label ?? 'Untitled field'}</span>
                <p className="whitespace-pre-wrap text-muted-foreground">{newField?.value}</p>
              </div>
            ) : !newField ? (
              <div className="text-sm text-destructive line-through opacity-70">
                <span className="font-medium">- {oldField.label || 'Untitled field'}</span>
                <p className="whitespace-pre-wrap">{oldField.value}</p>
              </div>
            ) : (
              <div className="text-sm">
                <p className="font-medium">
                  <WordDiffText oldValue={oldField.label} newValue={newField.label} />
                </p>
                <p className="whitespace-pre-wrap text-muted-foreground">
                  <WordDiffText oldValue={oldField.value} newValue={newField.value} />
                </p>
              </div>
            )
          }
        </div>
      ))}
    </div>
  );
}

export function CharacterAgentDraftDiff({ diffs, selectedFieldKeys, onToggleField }: iCharacterAgentDraftDiffProps) {
  if (diffs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
        The draft currently matches the live character.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {diffs.map((diff) => (
        <div key={diff.fieldKey} className="rounded-xl border bg-card">
          <label className="flex cursor-pointer items-center gap-2 border-b bg-muted/30 px-3 py-2">
            <Checkbox
              checked={selectedFieldKeys.has(diff.fieldKey)}
              onCheckedChange={() => onToggleField(diff.fieldKey)}
            />
            <span className="text-sm font-medium">{diff.label}</span>
          </label>
          <div className="max-h-56 overflow-y-auto px-3 py-2 text-sm">
            {diff.kind === 'text' ? <TextFieldDiff oldValue={diff.oldValue} newValue={diff.newValue} /> : null}
            {diff.kind === 'list' ? <ListFieldDiff oldValue={diff.oldValue} newValue={diff.newValue} /> : null}
            {diff.kind === 'custom-fields' ? (
              <CustomFieldsDiff oldValue={diff.oldValue} newValue={diff.newValue} />
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
