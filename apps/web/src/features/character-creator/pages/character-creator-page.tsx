import { useCallback, useMemo, useState } from 'react';
import { LuDownload, LuFileUp } from 'react-icons/lu';

import { toastError, toastSuccess } from '@~/components/toastifications';
import { Button } from '@~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@~/components/ui/card';

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
import { buildExampleContextSummary, getExampleContextCharacterBudget  } from '../lib/prompt-builder';
import type { iFieldGenerationTarget } from '../lib/prompt-builder';

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
    getFieldInstruction,
    updateFieldInstruction,
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
  const { portraitReference, portraitBlob, portraitObjectUrl, isHydratingPortrait, setPortrait, clearPortrait } =
    useCharacterPortrait();

  const { data } = card;
  const maxExampleContextCharacters = useMemo(
    () => getExampleContextCharacterBudget(generationSettings.contextSize, generationSettings.maxTokens),
    [generationSettings.contextSize, generationSettings.maxTokens],
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
        detailParts.length > 0 ? detailParts.join(' | ') : result.providerName ?? 'Provider metadata inferred.',
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
        toastError('Example limit reached', `Remove an example before importing another.`);
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
      await exportCharacterCardPng(card, portraitBlob);
      toastSuccess('PNG exported', 'The portrait now contains an updated `chara` metadata chunk.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The character card could not be exported as PNG.';
      toastError('PNG export failed', message);
      throw error;
    }
  }, [card, portraitBlob]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex-1 space-y-4">
          <p className="text-sm font-medium tracking-[0.3em] text-muted-foreground uppercase">Character Card Creator</p>
          <h1 className="text-3xl font-semibold tracking-tight">Build and generate V2 character cards</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Configure your endpoint once, then generate, continue, or manually edit each field with full local
            persistence.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setIsImportDialogOpen(true)}>
            <LuFileUp className="size-4" />
            Import
          </Button>
          <Button type="button" onClick={() => setIsExportDialogOpen(true)}>
            <LuDownload className="size-4" />
            Export
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generation Settings</CardTitle>
          <CardDescription>OpenAI-compatible chat completions with optional proxy streaming.</CardDescription>
        </CardHeader>
        <CardContent>
          <ApiSettings
            generationSettings={generationSettings}
            apiKey={apiKey}
            connectionHealth={connectionHealth}
            onApiKeyChange={updateApiKey}
            onHealthCheck={handleHealthCheck}
            onSettingsChange={updateGenerationSettings}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reference Examples</CardTitle>
          <CardDescription>Import 1-5 character cards and choose which fields feed AI generation.</CardDescription>
        </CardHeader>
        <CardContent>
          <ExampleCharacters
            exampleCharacters={exampleCharacters}
            contextSummary={exampleContextSummary}
            onImportFiles={handleImportExampleFiles}
            onRemove={removeExampleCharacter}
            onIncludedFieldKeysChange={updateExampleCharacterIncludedFields}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <ImageUpload
            portraitFileName={portraitReference?.fileName ?? null}
            portraitUrl={portraitObjectUrl}
            isHydratingPortrait={isHydratingPortrait}
            onSelectFile={handlePortraitSelect}
            onClear={clearPortrait}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Core Identity</CardTitle>
        </CardHeader>
        <CardContent>
          <CharacterField
            fieldId="character-name"
            label="Name"
            value={data.name}
            rows={1}
            instructionValue={getFieldInstruction('field:name')}
            generationErrorMessage={getFieldRuntime('field:name').errorMessage}
            isGenerating={getFieldRuntime('field:name').isGenerating}
            onValueChange={(value) => updateField('name', value)}
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Core Fields</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {CORE_FIELD_CONFIGS.map((config) => (
            <CharacterField
              key={config.key}
              fieldId={`character-${config.key}`}
              label={config.label}
              value={data[config.key]}
              rows={config.rows}
              hint={config.hint}
              instructionValue={getFieldInstruction(`field:${config.key}`)}
              generationErrorMessage={getFieldRuntime(`field:${config.key}`).errorMessage}
              isGenerating={getFieldRuntime(`field:${config.key}`).isGenerating}
              onValueChange={(value) => updateField(config.key, value)}
              onInstructionChange={(value) => updateFieldInstruction(`field:${config.key}`, value)}
              onGenerate={() => {
                runGeneration(createStandardFieldTarget(config.key, config.label, data[config.key]), (value) =>
                  updateField(config.key, value),
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
          ))}
        </CardContent>
      </Card>

      <ImportDialog isOpen={isImportDialogOpen} onOpenChange={setIsImportDialogOpen} onImportFile={handleImport} />
      <ExportDialog
        isOpen={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
        hasPortrait={portraitBlob !== null}
        onExportJson={handleExportJson}
        onExportPng={handleExportPng}
      />

      <Card>
        <CardHeader>
          <CardTitle>Alternate Greetings</CardTitle>
        </CardHeader>
        <CardContent>
          <AlternateGreetings
            greetings={data.alternate_greetings}
            generationStates={greetingGenerationStates}
            onAdd={addGreeting}
            onChange={updateGreeting}
            onRemove={handleRemoveGreeting}
            onMove={handleReorderGreetings}
            onInstructionChange={(index, value) => updateFieldInstruction(`alternate_greetings:${index}`, value)}
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prompt Overrides</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {PROMPT_OVERRIDE_FIELD_CONFIGS.map((config) => (
            <CharacterField
              key={config.key}
              fieldId={`character-${config.key}`}
              label={config.label}
              value={data[config.key]}
              rows={config.rows}
              hint={config.hint}
              instructionValue={getFieldInstruction(`field:${config.key}`)}
              generationErrorMessage={getFieldRuntime(`field:${config.key}`).errorMessage}
              isGenerating={getFieldRuntime(`field:${config.key}`).isGenerating}
              onValueChange={(value) => updateField(config.key, value)}
              onInstructionChange={(value) => updateFieldInstruction(`field:${config.key}`, value)}
              onGenerate={() => {
                runGeneration(createStandardFieldTarget(config.key, config.label, data[config.key]), (value) =>
                  updateField(config.key, value),
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
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Metadata</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {METADATA_FIELD_CONFIGS.map((config) => (
            <CharacterField
              key={config.key}
              fieldId={`character-${config.key}`}
              label={config.label}
              value={data[config.key]}
              rows={config.rows}
              hint={config.hint}
              instructionValue={getFieldInstruction(`field:${config.key}`)}
              generationErrorMessage={getFieldRuntime(`field:${config.key}`).errorMessage}
              isGenerating={getFieldRuntime(`field:${config.key}`).isGenerating}
              onValueChange={(value) => updateField(config.key, value)}
              onInstructionChange={(value) => updateFieldInstruction(`field:${config.key}`, value)}
              onGenerate={() => {
                runGeneration(createStandardFieldTarget(config.key, config.label, data[config.key]), (value) =>
                  updateField(config.key, value),
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
          ))}
          <TagsInput value={data.tags} onChange={updateTags} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Custom Fields</CardTitle>
        </CardHeader>
        <CardContent>
          <CustomFields
            fields={data.extensions.custom_fields}
            generationStates={customFieldGenerationStates}
            onAdd={addCustomField}
            onUpdate={updateCustomField}
            onRemove={handleRemoveCustomField}
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
        </CardContent>
      </Card>
    </div>
  );
}
