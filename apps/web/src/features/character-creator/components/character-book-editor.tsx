import { LuChevronDown, LuChevronUp, LuPlus, LuTrash2 } from 'react-icons/lu';

import { Button } from '@~/components/ui/button';
import { Checkbox } from '@~/components/ui/checkbox';
import { Input } from '@~/components/ui/input';
import { Label } from '@~/components/ui/label';

import type { CharacterBook, CharacterBookEntry } from '../lib/cards/card-schema';
import { MarkdownFieldEditor } from './editor/markdown-field-editor';

interface iCharacterBookEditorProps {
  characterBook: CharacterBook;
  onBookChange: (patch: Partial<Omit<CharacterBook, 'entries' | 'extensions'>>) => void;
  onAddEntry: () => void;
  onEntryChange: (index: number, patch: Partial<Omit<CharacterBookEntry, 'extensions'>>) => void;
  onRemoveEntry: (index: number) => void;
  onMoveEntry: (fromIndex: number, toIndex: number) => void;
}

function parseKeys(value: string) {
  return value
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean);
}

export function CharacterBookEditor({
  characterBook,
  onBookChange,
  onAddEntry,
  onEntryChange,
  onRemoveEntry,
  onMoveEntry,
}: iCharacterBookEditorProps) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="character-book-name">Book name</Label>
          <Input
            id="character-book-name"
            value={characterBook.name ?? ''}
            placeholder="Character lore"
            onChange={(event) => onBookChange({ name: event.target.value })}
          />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label id="character-book-description-label" htmlFor="character-book-description">
            Description
          </Label>
          <MarkdownFieldEditor
            fieldId="character-book-description"
            value={characterBook.description ?? ''}
            rows={3}
            placeholder="What this book contains"
            ariaLabelledBy="character-book-description-label"
            onValueChange={(description) => onBookChange({ description })}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
        <div>
          <h3 className="text-sm font-semibold">Entries</h3>
          <p className="text-sm text-muted-foreground">Keys are comma-separated activation terms.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onAddEntry}>
          <LuPlus className="size-4" />
          Add entry
        </Button>
      </div>

      {characterBook.entries.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          No character book entries yet.
        </p>
      ) : (
        <div className="space-y-3">
          {characterBook.entries.map((entry, index) => {
            const entryLabelId = `character-book-entry-${index}-label`;

            return (
              // Entries do not require ids in the V2 schema, so their ordered position is the only stable UI key.
              // eslint-disable-next-line react/no-array-index-key
              <section key={index} aria-labelledby={entryLabelId} className="space-y-4 rounded-md border p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 id={entryLabelId} className="text-sm font-semibold">
                    Entry {index + 1}
                  </h3>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Move entry up"
                      disabled={index === 0}
                      tooltip="Move entry up"
                      onClick={() => onMoveEntry(index, index - 1)}
                    >
                      <LuChevronUp className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Move entry down"
                      disabled={index === characterBook.entries.length - 1}
                      tooltip="Move entry down"
                      onClick={() => onMoveEntry(index, index + 1)}
                    >
                      <LuChevronDown className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove entry"
                      tooltip="Remove entry"
                      onClick={() => onRemoveEntry(index)}
                    >
                      <LuTrash2 className="size-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
                  <div className="grid gap-2">
                    <Label htmlFor={`character-book-entry-${index}-keys`}>Keys</Label>
                    <Input
                      id={`character-book-entry-${index}-keys`}
                      value={entry.keys.join(', ')}
                      placeholder="moon, archive, records"
                      onChange={(event) => onEntryChange(index, { keys: parseKeys(event.target.value) })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`character-book-entry-${index}-order`}>Insertion order</Label>
                    <Input
                      id={`character-book-entry-${index}-order`}
                      type="number"
                      value={entry.insertion_order}
                      onChange={(event) => onEntryChange(index, { insertion_order: event.target.valueAsNumber || 0 })}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label
                    id={`character-book-entry-${index}-content-label`}
                    htmlFor={`character-book-entry-${index}-content`}
                  >
                    Content
                  </Label>
                  <MarkdownFieldEditor
                    fieldId={`character-book-entry-${index}-content`}
                    value={entry.content}
                    rows={5}
                    placeholder="Lore inserted when this entry is activated"
                    ariaLabelledBy={`character-book-entry-${index}-content-label`}
                    onValueChange={(content) => onEntryChange(index, { content })}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`character-book-entry-${index}-enabled`}
                    checked={entry.enabled}
                    onCheckedChange={(isChecked) => onEntryChange(index, { enabled: isChecked === true })}
                  />
                  <Label htmlFor={`character-book-entry-${index}-enabled`}>Enabled</Label>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
