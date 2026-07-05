import { LuDownload, LuFileUp } from 'react-icons/lu';

import { Button } from '@~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@~/components/ui/dialog';

import { useCharacterCreatorContext } from '../context/character-creator-context/character-creator-context.hooks';
import { MAX_EXAMPLE_CHARACTER_COUNT } from '../lib/example-characters';
import { ApiSettings } from './api-settings';
import { ExampleCharacters } from './example-characters';

export function CharacterCreatorHeader() {
  const {
    generationSettings,
    apiKey,
    connectionHealth,
    selectedRequestModeLabel,
    maxExampleContextCharacters,
    exampleCharacters,
    exampleContextSummary,
    handleImportExampleFiles,
    removeExampleCharacter,
    updateExampleCharacterIncludedFields,
    updateApiKey,
    updateGenerationSettings,
    handleHealthCheck,
    openImportDialog,
    openExportDialog,
  } = useCharacterCreatorContext();

  return (
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
            <p className="text-xs text-muted-foreground">
              Context budget: {maxExampleContextCharacters.toLocaleString()} chars
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button type="button" size="sm" variant="outline">
                Reference Examples {exampleCharacters.length}/{MAX_EXAMPLE_CHARACTER_COUNT}
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
                <DialogDescription>OpenAI-compatible chat completions with optional proxy streaming.</DialogDescription>
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

          <Button type="button" size="sm" variant="outline" onClick={openImportDialog}>
            <LuFileUp className="size-4" />
            Import
          </Button>
          <Button type="button" size="sm" onClick={openExportDialog}>
            <LuDownload className="size-4" />
            Export
          </Button>
        </div>
      </div>
    </header>
  );
}
