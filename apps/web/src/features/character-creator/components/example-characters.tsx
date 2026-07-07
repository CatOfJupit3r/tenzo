import type { ChangeEvent, DragEvent } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { LuBookmarkPlus, LuFileUp, LuTrash2 } from 'react-icons/lu';

import { Badge } from '@~/components/ui/badge';
import { Button } from '@~/components/ui/button';
import { Checkbox } from '@~/components/ui/checkbox';
import { Label } from '@~/components/ui/label';
import { cn } from '@~/lib/utils';

import {
  EXAMPLE_CHARACTER_CONTEXT_FIELD_KEYS,
  EXAMPLE_CHARACTER_CONTEXT_FIELD_LABELS,
  MAX_EXAMPLE_CHARACTER_COUNT,
  getExampleCharacterDisplayName,
  hasExampleCharacterContextField,
} from '../lib/example-characters';
import type { ExampleCharacterContextFieldKey, iStoredExampleCharacter } from '../lib/example-characters';
import { TEMPLATE_FIELD_KEYS } from '../lib/field-templates';
import type { iCreateStoredFieldTemplateInput, TemplateFieldKey } from '../lib/field-templates';
import type { iExampleContextSummary } from '../lib/prompt/example-context-service';
import { SaveTemplateDialog } from './save-template-dialog';

const TEMPLATE_SOURCE_FIELD_KEYS = [
  'description',
  'personality',
  'scenario',
  'first_mes',
  'mes_example',
] as const satisfies readonly ExampleCharacterContextFieldKey[];

const TEMPLATE_SOURCE_FIELD_KEY_MAP = {
  description: TEMPLATE_FIELD_KEYS.description,
  personality: TEMPLATE_FIELD_KEYS.personality,
  scenario: TEMPLATE_FIELD_KEYS.scenario,
  first_mes: TEMPLATE_FIELD_KEYS.first_mes,
  mes_example: TEMPLATE_FIELD_KEYS.mes_example,
} satisfies Record<(typeof TEMPLATE_SOURCE_FIELD_KEYS)[number], TemplateFieldKey>;

interface iPendingTemplateSource {
  name: string;
  content: string;
  fieldKey: TemplateFieldKey;
}

export interface iExampleCharactersProps {
  exampleCharacters: iStoredExampleCharacter[];
  contextSummary: iExampleContextSummary;
  onImportFiles: (files: File[]) => Promise<void>;
  onRemove: (id: string) => void;
  onIncludedFieldKeysChange: (id: string, includedFieldKeys: ExampleCharacterContextFieldKey[]) => void;
  onSaveTemplate?: (input: iCreateStoredFieldTemplateInput) => void;
}

export function ExampleCharacters({
  exampleCharacters,
  contextSummary,
  onImportFiles,
  onRemove,
  onIncludedFieldKeysChange,
  onSaveTemplate,
}: iExampleCharactersProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [pendingTemplateSource, setPendingTemplateSource] = useState<iPendingTemplateSource | null>(null);

  const remainingSlots = MAX_EXAMPLE_CHARACTER_COUNT - exampleCharacters.length;
  const isAtLimit = remainingSlots <= 0;

  const helperText = useMemo(() => {
    if (isAtLimit) {
      return `Example limit reached. Remove one to import another.`;
    }

    return `${exampleCharacters.length}/${MAX_EXAMPLE_CHARACTER_COUNT} loaded. PNG and JSON cards stay local and feed generation prompts.`;
  }, [exampleCharacters.length, isAtLimit]);

  const handleImport = useCallback(
    async (files: FileList | File[] | null | undefined) => {
      const normalizedFiles = files ? Array.from(files) : [];

      if (normalizedFiles.length === 0) {
        return;
      }

      setIsImporting(true);

      try {
        await onImportFiles(normalizedFiles);
      } finally {
        setIsImporting(false);
      }
    },
    [onImportFiles],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium">Reference examples</p>
          <p className="text-sm text-muted-foreground">{helperText}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            accept=".json,.png,application/json,image/png"
            multiple
            onChange={async (event: ChangeEvent<HTMLInputElement>) => {
              await handleImport(event.target.files);
              event.target.value = '';
            }}
          />
          <Button
            disabled={isImporting || isAtLimit}
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
          >
            <LuFileUp className="size-4" />
            {isImporting ? 'Importing...' : 'Import examples'}
          </Button>
        </div>
      </div>

      <button
        className={cn(
          'flex min-h-36 w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/10 p-6 text-center transition-colors',
          isDraggingOver ? 'border-foreground/50 bg-muted/30' : null,
          isAtLimit ? 'cursor-not-allowed opacity-60' : null,
        )}
        disabled={isAtLimit || isImporting}
        type="button"
        onClick={() => {
          if (!isAtLimit) {
            inputRef.current?.click();
          }
        }}
        onDragEnter={(event: DragEvent<HTMLButtonElement>) => {
          event.preventDefault();
          if (!isAtLimit) {
            setIsDraggingOver(true);
          }
        }}
        onDragOver={(event: DragEvent<HTMLButtonElement>) => {
          event.preventDefault();
          if (!isAtLimit) {
            setIsDraggingOver(true);
          }
        }}
        onDragLeave={(event: DragEvent<HTMLButtonElement>) => {
          event.preventDefault();
          setIsDraggingOver(false);
        }}
        onDrop={async (event: DragEvent<HTMLButtonElement>) => {
          event.preventDefault();
          setIsDraggingOver(false);

          if (isAtLimit) {
            return;
          }

          await handleImport(event.dataTransfer.files);
        }}
      >
        <LuFileUp className="size-6" />
        <div className="space-y-1">
          <p className="text-sm font-medium">Drop example cards here</p>
          <p className="text-sm text-muted-foreground">
            Import up to {MAX_EXAMPLE_CHARACTER_COUNT} reference characters and choose which fields contribute to
            prompting.
          </p>
        </div>
      </button>

      {exampleCharacters.length > 0 ? (
        <div className="space-y-4">
          {contextSummary.totalCharacters > 0 ? (
            <div
              className={cn(
                'rounded-xl border px-4 py-3 text-sm',
                contextSummary.isTruncated
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100'
                  : 'border-border bg-muted/20 text-muted-foreground',
              )}
            >
              <p>
                Using {contextSummary.usedCharacters} of {contextSummary.totalCharacters} characters from reference
                examples in prompt context.
              </p>
              {contextSummary.isTruncated ? (
                <p className="mt-1">
                  Extra reference content is truncated during generation. Deselect fields or remove examples to fit more
                  context.
                </p>
              ) : null}
            </div>
          ) : null}

          {exampleCharacters.map((exampleCharacter) => {
            const displayName = getExampleCharacterDisplayName(exampleCharacter);

            return (
              <div key={exampleCharacter.id} className="rounded-xl border border-border bg-card/60 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold">{displayName}</h3>
                      <Badge variant="outline">{exampleCharacter.sourceKind.toUpperCase()}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{exampleCharacter.fileName}</p>
                  </div>

                  <Button type="button" variant="ghost" onClick={() => onRemove(exampleCharacter.id)}>
                    <LuTrash2 className="size-4" />
                    Remove
                  </Button>
                </div>

                {onSaveTemplate ? (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-medium">Save a field as a reusable template</p>
                    <div className="flex flex-wrap gap-2">
                      {TEMPLATE_SOURCE_FIELD_KEYS.filter((fieldKey) =>
                        hasExampleCharacterContextField(exampleCharacter, fieldKey),
                      ).map((fieldKey) => (
                        <Button
                          key={fieldKey}
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setPendingTemplateSource({
                              name: `${displayName} ${EXAMPLE_CHARACTER_CONTEXT_FIELD_LABELS[fieldKey]}`,
                              content: exampleCharacter.card.data[fieldKey],
                              fieldKey: TEMPLATE_SOURCE_FIELD_KEY_MAP[fieldKey],
                            })
                          }
                        >
                          <LuBookmarkPlus className="size-4" />
                          {EXAMPLE_CHARACTER_CONTEXT_FIELD_LABELS[fieldKey]}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium">Fields included in generation context</p>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {EXAMPLE_CHARACTER_CONTEXT_FIELD_KEYS.map((fieldKey) => {
                      const checkboxId = `${exampleCharacter.id}-${fieldKey}`;
                      const hasField = hasExampleCharacterContextField(exampleCharacter, fieldKey);
                      const isChecked = exampleCharacter.includedFieldKeys.includes(fieldKey);

                      return (
                        <Label
                          key={fieldKey}
                          className={cn(
                            'flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm',
                            !hasField ? 'opacity-50' : null,
                          )}
                          htmlFor={checkboxId}
                        >
                          <Checkbox
                            checked={hasField ? isChecked : undefined}
                            disabled={!hasField}
                            id={checkboxId}
                            onCheckedChange={(checked) => {
                              const nextFieldKeys =
                                checked === true
                                  ? [...exampleCharacter.includedFieldKeys, fieldKey]
                                  : exampleCharacter.includedFieldKeys.filter((key) => key !== fieldKey);

                              onIncludedFieldKeysChange(exampleCharacter.id, nextFieldKeys);
                            }}
                          />
                          <span>{EXAMPLE_CHARACTER_CONTEXT_FIELD_LABELS[fieldKey]}</span>
                        </Label>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {onSaveTemplate ? (
        <SaveTemplateDialog
          isOpen={pendingTemplateSource !== null}
          initialName={pendingTemplateSource?.name ?? ''}
          initialContent={pendingTemplateSource?.content ?? ''}
          initialFieldKeys={pendingTemplateSource ? [pendingTemplateSource.fieldKey] : []}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setPendingTemplateSource(null);
            }
          }}
          onSave={onSaveTemplate}
        />
      ) : null}
    </div>
  );
}
