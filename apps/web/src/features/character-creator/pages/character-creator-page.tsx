import { useCallback, useState } from 'react';
import { LuDownload, LuFileUp } from 'react-icons/lu';

import { toastError, toastSuccess } from '@~/components/toastifications';
import { Button } from '@~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@~/components/ui/card';

import { AlternateGreetings } from '../components/alternate-greetings';
import { CharacterField } from '../components/character-field';
import { CustomFields } from '../components/custom-fields';
import { ExportDialog } from '../components/export-dialog';
import { ImageUpload } from '../components/image-upload';
import { ImportDialog } from '../components/import-dialog';
import { TagsInput } from '../components/tags-input';
import { CORE_FIELD_CONFIGS, METADATA_FIELD_CONFIGS, PROMPT_OVERRIDE_FIELD_CONFIGS } from '../constants/field-config';
import { useCharacterPortrait } from '../hooks/use-character-portrait';
import { useCharacterSession } from '../hooks/use-character-session';
import { exportCharacterCardJson, exportCharacterCardPng, importCharacterCardFile } from '../lib/card-files';

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
    replaceCard,
  } = useCharacterSession();
  const { portraitReference, portraitBlob, portraitObjectUrl, isHydratingPortrait, setPortrait, clearPortrait } =
    useCharacterPortrait();

  const { data } = card;

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
    [clearPortrait, replaceCard, setPortrait],
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
          <CharacterField
            fieldId="character-name"
            label="Name"
            value={data.name}
            rows={1}
            onValueChange={(value) => updateField('name', value)}
          />
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
            onValueChange={(value) => updateField('name', value)}
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
              onValueChange={(value) => updateField(config.key, value)}
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
            onAdd={addGreeting}
            onChange={updateGreeting}
            onRemove={removeGreeting}
            onMove={reorderGreetings}
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
              onValueChange={(value) => updateField(config.key, value)}
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
              onValueChange={(value) => updateField(config.key, value)}
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
            onAdd={addCustomField}
            onUpdate={updateCustomField}
            onRemove={removeCustomField}
          />
        </CardContent>
      </Card>
    </div>
  );
}
