import { useCallback, useMemo, useState } from 'react';
import { LuDownload, LuFileUp } from 'react-icons/lu';

import { toastError, toastSuccess } from '@~/components/toastifications';
import { Button } from '@~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@~/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@~/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@~/components/ui/tabs';
import { cn } from '@~/lib/utils';

import { AlternateGreetings } from '../components/alternate-greetings';
import { ApiSettings } from '../components/api-settings';
import { CharacterField } from '../components/character-field';
import { CustomFields } from '../components/custom-fields';
import { ExampleCharacters } from '../components/example-characters';
import { ExportDialog } from '../components/export-dialog';
import { ImageUpload } from '../components/image-upload';
import { ImportDialog } from '../components/import-dialog';
import { TagsInput } from '../components/tags-input';
import { CORE_FIELD_CONFIGS, METADATA_FIELD_CONFIGS, PROMPT_OVERRIDE_FIELD_CONFIGS } from '../constants/field-config';
import { useCharacterPortrait } from '../hooks/use-character-portrait';
import { useCharacterSession } from '../hooks/use-character-session';
import { useGeneration } from '../hooks/use-generation';
import { exportCharacterCardJson, exportCharacterCardPng, importCharacterCardFile } from '../lib/card-files';
import type { CharacterTextFieldKey } from '../lib/card-schema';
import {
  createStoredExampleCharacter,
  getExampleCharacterDisplayName,
  MAX_EXAMPLE_CHARACTER_COUNT,
  toPromptExampleCharacter,
} from '../lib/example-characters';
import { REQUEST_MODES } from '../lib/generation-config';
import { buildExampleContextSummary, getExampleContextCharacterBudget } from '../lib/prompt-builder';
import type { iFieldGenerationTarget } from '../lib/prompt-builder';

const CHARACTER_CREATOR_TABS = {
  core: 'core',
  dialogue: 'dialogue',
  overrides: 'overrides',
  metadata: 'metadata',
} as const;

const FIELD_PANEL_CLASS_NAME = 'rounded-2xl border bg-card/70 p-4 shadow-sm';

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}

function createStandardFieldTarget(key: CharacterTextFieldKey, label: string, value: string): iFieldGenerationTarget {
  return {
    key: `field:${key}`,
    label,
    value,
    kind: 'field',
  };
}

export function CharacterCreatorPage() {
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const {
    card,
    updateField,
    updateTags,
    addGreeting,
    updateGreeting,
    removeGreeting,
    reorderGreetings,
    addCustomField,
    updateCustomField,
    removeCustomField,
    exampleCharacters,
    addExampleCharacters,
    updateExampleCharacterIncludedFields,
    removeExampleCharacter,
    replaceCard,
  } = useCharacterSession();
  const {
    generationSettings,
    apiKey,
    updateApiKey,
    updateGenerationSettings,
    getGeneralCharacterIdea,
    updateGeneralCharacterIdea,
    getFieldInstruction,
    updateFieldInstruction,
    shouldUseGeneralCharacterIdea,
    updateFieldShouldUseGeneralCharacterIdea,
    removeCustomFieldInstruction,
    removeAlternateGreetingInstruction,
    reorderAlternateGreetingInstructions,
    clearDynamicFieldInstructions,
    connectionHealth,
    generateField,
    cancelGeneration,
    getFieldRuntime,
    probeConnection,
  } = useGeneration();
  const {
    portraitReference,
    portraitBlob,
    portraitDimensions,
    portraitObjectUrl,
    isHydratingPortrait,
    portraitCropRect,
    setPortrait,
    updatePortraitCropRect,
    clearPortrait,
  } = useCharacterPortrait();

  const { data } = card;
  const generalCharacterIdea = getGeneralCharacterIdea();
  const hasLoadedExamples = exampleCharacters.length > 0;
  const selectedRequestModeLabel =
    generationSettings.requestMode === REQUEST_MODES.proxy ? 'Server proxy' : 'Browser request';
  const maxExampleContextCharacters = getExampleContextCharacterBudget(
    generationSettings.contextSize,
    generationSettings.maxTokens,
  );
  const promptExampleCharacters = useMemo(
    () => exampleCharacters.map((exampleCharacter) => toPromptExampleCharacter(exampleCharacter)),
    [exampleCharacters],
  );
  const exampleContextSummary = useMemo(
    () => buildExampleContextSummary(promptExampleCharacters, maxExampleContextCharacters),
    [maxExampleContextCharacters, promptExampleCharacters],
  );

  const runGeneration = useCallback(
    async (target: iFieldGenerationTarget, onValueChange: (value: string) => unknown, isContinuation = false) => {
      try {
        await generateField({
          card,
          target,
          onValueChange,
          isContinuation,
          exampleCharacters: promptExampleCharacters,
          maxExampleContextCharacters,
        });
      } catch (error) {
        if (isAbortError(error)) {
          return;
        }

        const message = error instanceof Error ? error.message : 'The model request failed.';
        toastError('Generation failed', message);
      }
    },
    [card, generateField, maxExampleContextCharacters, promptExampleCharacters],
  );

  const handleHealthCheck = useCallback(async () => {
    try {
      const result = await probeConnection();
      const detailParts = [
        result.currentModel ?? result.models[0] ?? null,
        result.contextSize ? `${result.contextSize} context` : null,
      ].filter((value): value is string => Boolean(value));

      toastSuccess(
        'Endpoint checked',
        detailParts.length > 0 ? detailParts.join(' | ') : (result.providerName ?? 'Provider metadata inferred.'),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Health check failed.';
      toastError('Health check failed', message);
    }
  }, [probeConnection]);

  const handlePortraitSelect = useCallback(
    async (file: File) => {
      await setPortrait(file, file.name);
      toastSuccess('Portrait updated', file.name);
    },
    [setPortrait],
  );

  const handleImport = useCallback(
    async (file: File) => {
      try {
        const importedCardFile = await importCharacterCardFile(file);
        replaceCard(importedCardFile.card);
        clearDynamicFieldInstructions();

        if (importedCardFile.portraitBlob) {
          await setPortrait(importedCardFile.portraitBlob, importedCardFile.fileName);
        } else {
          await clearPortrait();
        }

        toastSuccess('Character imported', importedCardFile.fileName);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'The selected file could not be imported.';
        toastError('Import failed', message);
        throw error;
      }
    },
    [clearDynamicFieldInstructions, clearPortrait, replaceCard, setPortrait],
  );

  const handleRemoveGreeting = useCallback(
    (index: number) => {
      removeGreeting(index);
      removeAlternateGreetingInstruction(index);
    },
    [removeAlternateGreetingInstruction, removeGreeting],
  );

  const handleReorderGreetings = useCallback(
    (fromIndex: number, toIndex: number) => {
      reorderGreetings(fromIndex, toIndex);
      reorderAlternateGreetingInstructions(fromIndex, toIndex);
    },
    [reorderAlternateGreetingInstructions, reorderGreetings],
  );

  const handleRemoveCustomField = useCallback(
    (id: string) => {
      removeCustomField(id);
      removeCustomFieldInstruction(id);
    },
    [removeCustomField, removeCustomFieldInstruction],
  );

  const handleImportExampleFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) {
        return;
      }

      const availableSlots = MAX_EXAMPLE_CHARACTER_COUNT - exampleCharacters.length;

      if (availableSlots <= 0) {
        toastError('Example limit reached', 'Remove an example before importing another.');
        return;
      }

      const importedExamples = [];
      const failedImports: string[] = [];

      for (const file of files.slice(0, availableSlots)) {
        try {
          const importedCardFile = await importCharacterCardFile(file);
          importedExamples.push(createStoredExampleCharacter(importedCardFile));
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Import failed.';
          failedImports.push(`${file.name}: ${message}`);
        }
      }

      if (importedExamples.length > 0) {
        addExampleCharacters(importedExamples);
        const firstImportedName = getExampleCharacterDisplayName(importedExamples[0]);

        toastSuccess(
          'Reference characters imported',
          importedExamples.length === 1
            ? `${firstImportedName} is ready for generation context.`
            : `${importedExamples.length} examples are ready for generation context.`,
        );
      }

      if (files.length > availableSlots) {
        toastError(
          'Example limit reached',
          `Only ${availableSlots} of ${files.length} selected files were imported. The session supports up to ${MAX_EXAMPLE_CHARACTER_COUNT} examples.`,
        );
      }

      if (failedImports.length > 0) {
        toastError('Some examples were skipped', failedImports.join(' | '));
      }
    },
    [addExampleCharacters, exampleCharacters.length],
  );

  const greetingGenerationStates = data.alternate_greetings.map((_, index) => {
    const fieldKey = `alternate_greetings:${index}`;
    const runtime = getFieldRuntime(fieldKey);

    return {
      shouldUseGeneralCharacterIdea: shouldUseGeneralCharacterIdea(fieldKey),
      instructionValue: getFieldInstruction(fieldKey),
      errorMessage: runtime.errorMessage,
      isGenerating: runtime.isGenerating,
    };
  });

  const customFieldGenerationStates = Object.fromEntries(
    data.extensions.custom_fields.map((field) => {
      const fieldKey = `custom:${field.id}`;
      const runtime = getFieldRuntime(fieldKey);

      return [
        field.id,
        {
          shouldUseGeneralCharacterIdea: shouldUseGeneralCharacterIdea(fieldKey),
          instructionValue: getFieldInstruction(fieldKey),
          errorMessage: runtime.errorMessage,
          isGenerating: runtime.isGenerating,
        },
      ];
    }),
  );

  const handleExportJson = useCallback(async () => {
    try {
      await exportCharacterCardJson(card);
      toastSuccess('JSON exported', 'The hybrid V1+V2 card file has been downloaded.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The character card could not be exported as JSON.';
      toastError('JSON export failed', message);
      throw error;
    }
  }, [card]);

  const handleExportPng = useCallback(async () => {
    if (!portraitBlob) {
      toastError('PNG export failed', 'Add a portrait image before exporting PNG.');
      return;
    }

    try {
      await exportCharacterCardPng(card, portraitBlob, portraitCropRect);
      toastSuccess('PNG exported', 'The portrait now contains an updated `chara` metadata chunk.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The character card could not be exported as PNG.';
      toastError('PNG export failed', message);
      throw error;
    }
  }, [card, portraitBlob, portraitCropRect]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(234,88,12,0.10),transparent_32%),linear-gradient(to_bottom,rgba(245,245,244,0.65),transparent_30%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.10),transparent_32%),linear-gradient(to_bottom,rgba(38,38,38,0.35),transparent_30%)]">
      <header className="sticky top-0 z-20 border-b bg-background/92 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm">
              C
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-semibold">Character Card Creator</p>
              <p className="text-xs text-muted-foreground">
                {selectedRequestModeLabel} | {generationSettings.model || 'Model not set'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button type="button" size="sm" variant="outline">
                  Reference Examples
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
                <DialogHeader>
                  <DialogTitle>Reference Examples</DialogTitle>
                  <DialogDescription>
                    Import 1-5 character cards and choose which fields feed AI generation.
                  </DialogDescription>
                </DialogHeader>
                <ExampleCharacters
                  exampleCharacters={exampleCharacters}
                  contextSummary={exampleContextSummary}
                  onImportFiles={handleImportExampleFiles}
                  onRemove={removeExampleCharacter}
                  onIncludedFieldKeysChange={updateExampleCharacterIncludedFields}
                />
              </DialogContent>
            </Dialog>

            <Dialog>
              <DialogTrigger asChild>
                <Button type="button" size="sm" variant="outline">
                  Generation Settings
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Generation Settings</DialogTitle>
                  <DialogDescription>
                    OpenAI-compatible chat completions with optional proxy streaming.
                  </DialogDescription>
                </DialogHeader>
                <ApiSettings
                  generationSettings={generationSettings}
                  apiKey={apiKey}
                  connectionHealth={connectionHealth}
                  onApiKeyChange={updateApiKey}
                  onHealthCheck={handleHealthCheck}
                  onSettingsChange={updateGenerationSettings}
                />
              </DialogContent>
            </Dialog>

            <div className="hidden h-5 w-px bg-border sm:block" />

            <Button type="button" size="sm" variant="outline" onClick={() => setIsImportDialogOpen(true)}>
              <LuFileUp className="size-4" />
              Import
            </Button>
            <Button type="button" size="sm" onClick={() => setIsExportDialogOpen(true)}>
              <LuDownload className="size-4" />
              Export
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 pt-8 pb-16 sm:px-6 lg:px-8">
        <div className="space-y-3 pb-8">
          <div className="flex flex-wrap gap-2 pt-1 text-xs text-muted-foreground">
            <span className="rounded-full border bg-background/80 px-3 py-1">
              {hasLoadedExamples
                ? `${exampleCharacters.length} reference examples loaded`
                : 'No reference examples loaded'}
            </span>
            <span className="rounded-full border bg-background/80 px-3 py-1">
              Context budget: {maxExampleContextCharacters.toLocaleString()} chars
            </span>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <Card className="gap-4 bg-card/95 shadow-sm">
              <CardHeader>
                <CardTitle>Portrait</CardTitle>
                <CardDescription>
                  Upload PNG, JPG, or WebP. Reframe the 2:3 export crop and preview avatar surfaces without leaving the
                  page.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ImageUpload
                  portraitFileName={portraitReference?.fileName ?? null}
                  portraitDimensions={portraitDimensions}
                  portraitCropRect={portraitCropRect}
                  portraitUrl={portraitObjectUrl}
                  isHydratingPortrait={isHydratingPortrait}
                  onSelectFile={handlePortraitSelect}
                  onCropRectChange={updatePortraitCropRect}
                  onClear={clearPortrait}
                />
              </CardContent>
            </Card>

            <Card className="gap-4 bg-card/95 shadow-sm">
              <CardHeader>
                <CardTitle>Core Identity</CardTitle>
                <CardDescription>Name the card and keep browse-facing tags tidy.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <CharacterField
                  fieldId="character-name"
                  label="Name"
                  value={data.name}
                  rows={1}
                  shouldUseGeneralCharacterIdea={shouldUseGeneralCharacterIdea('field:name')}
                  instructionValue={getFieldInstruction('field:name')}
                  generationErrorMessage={getFieldRuntime('field:name').errorMessage}
                  isGenerating={getFieldRuntime('field:name').isGenerating}
                  onValueChange={(value) => updateField('name', value)}
                  onShouldUseGeneralCharacterIdeaChange={(value) =>
                    updateFieldShouldUseGeneralCharacterIdea('field:name', value)
                  }
                  onInstructionChange={(value) => updateFieldInstruction('field:name', value)}
                  onGenerate={() => {
                    runGeneration(createStandardFieldTarget('name', 'Name', data.name), (value) =>
                      updateField('name', value),
                    ).catch(() => undefined);
                  }}
                  onContinue={() => {
                    runGeneration(
                      createStandardFieldTarget('name', 'Name', data.name),
                      (value) => updateField('name', value),
                      true,
                    ).catch(() => undefined);
                  }}
                  onCancel={() => cancelGeneration('field:name')}
                />
                <TagsInput value={data.tags} onChange={updateTags} />
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue={CHARACTER_CREATOR_TABS.core} className="gap-4">
            <Card className="gap-0 overflow-hidden bg-card/95 py-0 shadow-sm">
              <div className="border-b px-4 py-4 sm:px-6">
                <TabsList className="h-auto w-full flex-wrap justify-start gap-2 rounded-none bg-transparent p-0 text-foreground">
                  <TabsTrigger
                    value={CHARACTER_CREATOR_TABS.core}
                    className="h-10 flex-none rounded-full border bg-background px-4 data-[state=active]:border-border data-[state=active]:bg-card"
                  >
                    Core Fields
                  </TabsTrigger>
                  <TabsTrigger
                    value={CHARACTER_CREATOR_TABS.dialogue}
                    className="h-10 flex-none rounded-full border bg-background px-4 data-[state=active]:border-border data-[state=active]:bg-card"
                  >
                    Dialogue
                  </TabsTrigger>
                  <TabsTrigger
                    value={CHARACTER_CREATOR_TABS.overrides}
                    className="h-10 flex-none rounded-full border bg-background px-4 data-[state=active]:border-border data-[state=active]:bg-card"
                  >
                    Prompt Overrides
                  </TabsTrigger>
                  <TabsTrigger
                    value={CHARACTER_CREATOR_TABS.metadata}
                    className="h-10 flex-none rounded-full border bg-background px-4 data-[state=active]:border-border data-[state=active]:bg-card"
                  >
                    Metadata
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value={CHARACTER_CREATOR_TABS.core} className="p-4 sm:p-6">
                <div className="grid gap-4 xl:grid-cols-2">
                  {CORE_FIELD_CONFIGS.filter(
                    (config) => config.key !== 'first_mes' && config.key !== 'mes_example',
                  ).map((config) => {
                    const isWideField = config.key === 'description';

                    return (
                      <div
                        key={config.key}
                        className={cn(FIELD_PANEL_CLASS_NAME, isWideField ? 'xl:col-span-2' : null)}
                      >
                        <CharacterField
                          fieldId={`character-${config.key}`}
                          label={config.label}
                          value={data[config.key]}
                          rows={config.rows}
                          hint={config.hint}
                          shouldUseGeneralCharacterIdea={shouldUseGeneralCharacterIdea(`field:${config.key}`)}
                          instructionValue={getFieldInstruction(`field:${config.key}`)}
                          generationErrorMessage={getFieldRuntime(`field:${config.key}`).errorMessage}
                          isGenerating={getFieldRuntime(`field:${config.key}`).isGenerating}
                          onValueChange={(value) => updateField(config.key, value)}
                          onShouldUseGeneralCharacterIdeaChange={(value) =>
                            updateFieldShouldUseGeneralCharacterIdea(`field:${config.key}`, value)
                          }
                          onInstructionChange={(value) => updateFieldInstruction(`field:${config.key}`, value)}
                          onGenerate={() => {
                            runGeneration(
                              createStandardFieldTarget(config.key, config.label, data[config.key]),
                              (value) => updateField(config.key, value),
                            ).catch(() => undefined);
                          }}
                          onContinue={() => {
                            runGeneration(
                              createStandardFieldTarget(config.key, config.label, data[config.key]),
                              (value) => updateField(config.key, value),
                              true,
                            ).catch(() => undefined);
                          }}
                          onCancel={() => cancelGeneration(`field:${config.key}`)}
                        />
                      </div>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value={CHARACTER_CREATOR_TABS.dialogue} className="space-y-4 p-4 sm:p-6">
                {CORE_FIELD_CONFIGS.filter((config) => config.key === 'first_mes' || config.key === 'mes_example').map(
                  (config) => (
                    <div key={config.key} className={FIELD_PANEL_CLASS_NAME}>
                      <CharacterField
                        fieldId={`character-${config.key}`}
                        label={config.label}
                        value={data[config.key]}
                        rows={config.rows}
                        hint={config.hint}
                        shouldUseGeneralCharacterIdea={shouldUseGeneralCharacterIdea(`field:${config.key}`)}
                        instructionValue={getFieldInstruction(`field:${config.key}`)}
                        generationErrorMessage={getFieldRuntime(`field:${config.key}`).errorMessage}
                        isGenerating={getFieldRuntime(`field:${config.key}`).isGenerating}
                        onValueChange={(value) => updateField(config.key, value)}
                        onShouldUseGeneralCharacterIdeaChange={(value) =>
                          updateFieldShouldUseGeneralCharacterIdea(`field:${config.key}`, value)
                        }
                        onInstructionChange={(value) => updateFieldInstruction(`field:${config.key}`, value)}
                        onGenerate={() => {
                          runGeneration(
                            createStandardFieldTarget(config.key, config.label, data[config.key]),
                            (value) => updateField(config.key, value),
                          ).catch(() => undefined);
                        }}
                        onContinue={() => {
                          runGeneration(
                            createStandardFieldTarget(config.key, config.label, data[config.key]),
                            (value) => updateField(config.key, value),
                            true,
                          ).catch(() => undefined);
                        }}
                        onCancel={() => cancelGeneration(`field:${config.key}`)}
                      />
                    </div>
                  ),
                )}

                <div className={FIELD_PANEL_CLASS_NAME}>
                  <AlternateGreetings
                    greetings={data.alternate_greetings}
                    generationStates={greetingGenerationStates}
                    onAdd={addGreeting}
                    onChange={updateGreeting}
                    onRemove={handleRemoveGreeting}
                    onMove={handleReorderGreetings}
                    onShouldUseGeneralCharacterIdeaChange={(index, value) =>
                      updateFieldShouldUseGeneralCharacterIdea(`alternate_greetings:${index}`, value)
                    }
                    onInstructionChange={(index, value) =>
                      updateFieldInstruction(`alternate_greetings:${index}`, value)
                    }
                    onGenerate={(index) => {
                      runGeneration(
                        {
                          key: `alternate_greetings:${index}`,
                          label: `Alternate Greeting ${index + 1}`,
                          value: data.alternate_greetings[index] ?? '',
                          kind: 'alternate-greeting',
                        },
                        (value) => updateGreeting(index, value),
                      ).catch(() => undefined);
                    }}
                    onContinue={(index) => {
                      runGeneration(
                        {
                          key: `alternate_greetings:${index}`,
                          label: `Alternate Greeting ${index + 1}`,
                          value: data.alternate_greetings[index] ?? '',
                          kind: 'alternate-greeting',
                        },
                        (value) => updateGreeting(index, value),
                        true,
                      ).catch(() => undefined);
                    }}
                    onCancel={(index) => cancelGeneration(`alternate_greetings:${index}`)}
                  />
                </div>
              </TabsContent>

              <TabsContent value={CHARACTER_CREATOR_TABS.overrides} className="p-4 sm:p-6">
                <div className="grid gap-4 xl:grid-cols-2">
                  {PROMPT_OVERRIDE_FIELD_CONFIGS.map((config) => (
                    <div key={config.key} className={FIELD_PANEL_CLASS_NAME}>
                      <CharacterField
                        fieldId={`character-${config.key}`}
                        label={config.label}
                        value={data[config.key]}
                        rows={config.rows}
                        hint={config.hint}
                        shouldUseGeneralCharacterIdea={shouldUseGeneralCharacterIdea(`field:${config.key}`)}
                        instructionValue={getFieldInstruction(`field:${config.key}`)}
                        generationErrorMessage={getFieldRuntime(`field:${config.key}`).errorMessage}
                        isGenerating={getFieldRuntime(`field:${config.key}`).isGenerating}
                        onValueChange={(value) => updateField(config.key, value)}
                        onShouldUseGeneralCharacterIdeaChange={(value) =>
                          updateFieldShouldUseGeneralCharacterIdea(`field:${config.key}`, value)
                        }
                        onInstructionChange={(value) => updateFieldInstruction(`field:${config.key}`, value)}
                        onGenerate={() => {
                          runGeneration(
                            createStandardFieldTarget(config.key, config.label, data[config.key]),
                            (value) => updateField(config.key, value),
                          ).catch(() => undefined);
                        }}
                        onContinue={() => {
                          runGeneration(
                            createStandardFieldTarget(config.key, config.label, data[config.key]),
                            (value) => updateField(config.key, value),
                            true,
                          ).catch(() => undefined);
                        }}
                        onCancel={() => cancelGeneration(`field:${config.key}`)}
                      />
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value={CHARACTER_CREATOR_TABS.metadata} className="space-y-4 p-4 sm:p-6">
                <div className={FIELD_PANEL_CLASS_NAME}>
                  <CharacterField
                    fieldId="general-character-idea"
                    label="General Character Idea"
                    value={generalCharacterIdea}
                    rows={4}
                    hint="Shared concept, tone, or high-level direction available to every field generation."
                    onValueChange={updateGeneralCharacterIdea}
                  />
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  {METADATA_FIELD_CONFIGS.map((config) => {
                    const isWideField = config.key === 'creator_notes';

                    return (
                      <div
                        key={config.key}
                        className={cn(FIELD_PANEL_CLASS_NAME, isWideField ? 'xl:col-span-2' : null)}
                      >
                        <CharacterField
                          fieldId={`character-${config.key}`}
                          label={config.label}
                          value={data[config.key]}
                          rows={config.rows}
                          hint={config.hint}
                          shouldUseGeneralCharacterIdea={shouldUseGeneralCharacterIdea(`field:${config.key}`)}
                          instructionValue={getFieldInstruction(`field:${config.key}`)}
                          generationErrorMessage={getFieldRuntime(`field:${config.key}`).errorMessage}
                          isGenerating={getFieldRuntime(`field:${config.key}`).isGenerating}
                          onValueChange={(value) => updateField(config.key, value)}
                          onShouldUseGeneralCharacterIdeaChange={(value) =>
                            updateFieldShouldUseGeneralCharacterIdea(`field:${config.key}`, value)
                          }
                          onInstructionChange={(value) => updateFieldInstruction(`field:${config.key}`, value)}
                          onGenerate={() => {
                            runGeneration(
                              createStandardFieldTarget(config.key, config.label, data[config.key]),
                              (value) => updateField(config.key, value),
                            ).catch(() => undefined);
                          }}
                          onContinue={() => {
                            runGeneration(
                              createStandardFieldTarget(config.key, config.label, data[config.key]),
                              (value) => updateField(config.key, value),
                              true,
                            ).catch(() => undefined);
                          }}
                          onCancel={() => cancelGeneration(`field:${config.key}`)}
                        />
                      </div>
                    );
                  })}
                </div>

                <div className={FIELD_PANEL_CLASS_NAME}>
                  <CustomFields
                    fields={data.extensions.custom_fields}
                    generationStates={customFieldGenerationStates}
                    onAdd={addCustomField}
                    onUpdate={updateCustomField}
                    onRemove={handleRemoveCustomField}
                    onShouldUseGeneralCharacterIdeaChange={(id, value) =>
                      updateFieldShouldUseGeneralCharacterIdea(`custom:${id}`, value)
                    }
                    onInstructionChange={(id, value) => updateFieldInstruction(`custom:${id}`, value)}
                    onGenerate={(id) => {
                      const customField = data.extensions.custom_fields.find((field) => field.id === id);
                      if (!customField) {
                        return;
                      }

                      runGeneration(
                        {
                          key: `custom:${id}`,
                          label: customField.label.trim() || 'Custom Field',
                          value: customField.value,
                          kind: 'custom-field',
                        },
                        (value) => updateCustomField(id, { value }),
                      ).catch(() => undefined);
                    }}
                    onContinue={(id) => {
                      const customField = data.extensions.custom_fields.find((field) => field.id === id);
                      if (!customField) {
                        return;
                      }

                      runGeneration(
                        {
                          key: `custom:${id}`,
                          label: customField.label.trim() || 'Custom Field',
                          value: customField.value,
                          kind: 'custom-field',
                        },
                        (value) => updateCustomField(id, { value }),
                        true,
                      ).catch(() => undefined);
                    }}
                    onCancel={(id) => cancelGeneration(`custom:${id}`)}
                  />
                </div>
              </TabsContent>
            </Card>
          </Tabs>
        </div>
      </div>

      <ImportDialog isOpen={isImportDialogOpen} onOpenChange={setIsImportDialogOpen} onImportFile={handleImport} />
      <ExportDialog
        isOpen={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
        hasPortrait={portraitBlob !== null}
        onExportJson={handleExportJson}
        onExportPng={handleExportPng}
      />
    </div>
  );
}
