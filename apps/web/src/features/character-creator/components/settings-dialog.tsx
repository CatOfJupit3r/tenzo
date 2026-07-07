import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@~/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@~/components/ui/tabs';

import { useCharacterCreatorContext } from '../context/character-creator-context/character-creator-context.hooks';
import { MAX_EXAMPLE_CHARACTER_COUNT } from '../lib/example-characters';
import { ConnectionSettings } from './connection-settings';
import { ExampleCharacters } from './example-characters';
import { FieldTemplatesPanel } from './field-templates-panel';
import { SamplingSettings } from './sampling-settings';
import { SETTINGS_DIALOG_TABS, settingsDialogTabSchema } from './settings-dialog-tabs';
import type { SettingsDialogTab } from './settings-dialog-tabs';

export interface iSettingsDialogProps {
  isOpen: boolean;
  activeTab: SettingsDialogTab;
  onOpenChange: (isOpen: boolean) => void;
  onTabChange: (tab: SettingsDialogTab) => void;
}

export function SettingsDialog({ isOpen, activeTab, onOpenChange, onTabChange }: iSettingsDialogProps) {
  const {
    generationSettings,
    apiKey,
    connectionHealth,
    updateApiKey,
    updateGenerationSettings,
    handleHealthCheck,
    fieldTemplates,
    addFieldTemplate,
    updateFieldTemplate,
    removeFieldTemplate,
    duplicateFieldTemplate,
    exampleCharacters,
    exampleContextSummary,
    handleImportExampleFiles,
    removeExampleCharacter,
    updateExampleCharacterIncludedFields,
  } = useCharacterCreatorContext();

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[min(96vw,80rem)] flex-col sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Provider connection, sampling, field templates, and reference examples for AI generation.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          className="min-h-0 flex-1"
          value={activeTab}
          onValueChange={(value) => {
            const parsedTab = settingsDialogTabSchema.safeParse(value);

            if (parsedTab.success) {
              onTabChange(parsedTab.data);
            }
          }}
        >
          <TabsList className="w-full">
            <TabsTrigger value={SETTINGS_DIALOG_TABS.connection}>Connection</TabsTrigger>
            <TabsTrigger value={SETTINGS_DIALOG_TABS.sampling}>Sampling</TabsTrigger>
            <TabsTrigger value={SETTINGS_DIALOG_TABS.templates}>Templates</TabsTrigger>
            <TabsTrigger value={SETTINGS_DIALOG_TABS.examples}>
              Reference Examples {exampleCharacters.length}/{MAX_EXAMPLE_CHARACTER_COUNT}
            </TabsTrigger>
          </TabsList>

          <TabsContent value={SETTINGS_DIALOG_TABS.connection} className="min-h-0 overflow-y-auto pt-2 pr-1">
            <ConnectionSettings
              generationSettings={generationSettings}
              apiKey={apiKey}
              connectionHealth={connectionHealth}
              onApiKeyChange={updateApiKey}
              onHealthCheck={handleHealthCheck}
              onSettingsChange={updateGenerationSettings}
            />
          </TabsContent>

          <TabsContent value={SETTINGS_DIALOG_TABS.sampling} className="min-h-0 overflow-y-auto pt-2 pr-1">
            <SamplingSettings generationSettings={generationSettings} onSettingsChange={updateGenerationSettings} />
          </TabsContent>

          <TabsContent value={SETTINGS_DIALOG_TABS.templates} className="min-h-0 overflow-y-auto pt-2 pr-1">
            <FieldTemplatesPanel
              fieldTemplates={fieldTemplates}
              onAddTemplate={addFieldTemplate}
              onUpdateTemplate={updateFieldTemplate}
              onRemoveTemplate={removeFieldTemplate}
              onDuplicateTemplate={duplicateFieldTemplate}
            />
          </TabsContent>

          <TabsContent value={SETTINGS_DIALOG_TABS.examples} className="min-h-0 overflow-y-auto pt-2 pr-1">
            <ExampleCharacters
              exampleCharacters={exampleCharacters}
              contextSummary={exampleContextSummary}
              onImportFiles={handleImportExampleFiles}
              onRemove={removeExampleCharacter}
              onIncludedFieldKeysChange={updateExampleCharacterIncludedFields}
              onSaveTemplate={addFieldTemplate}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
