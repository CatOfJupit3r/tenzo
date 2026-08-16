import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@~/components/ui/dialog';
import { Switch } from '@~/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@~/components/ui/tabs';

import { useCharacterCreatorContext } from '../context/character-creator-context/character-creator-context.hooks';
import { useTemplateEnhancement } from '../hooks/use-template-enhancement';
import { MAX_EXAMPLE_CHARACTER_COUNT } from '../lib/cards/example-characters';
import { AssistantEditingSettings } from './assistant-editing-settings';
import { ConnectionSettings } from './connection-settings';
import { ExampleCharacters } from './example-characters';
import { FieldTemplatesPanel } from './field-templates-panel';
import { SamplingSettings } from './sampling-settings';
import { SETTINGS_DIALOG_TABS, settingsDialogTabSchema } from './settings-dialog-tabs';
import type { SettingsDialogTab } from './settings-dialog-tabs';

const SETTINGS_TAB_CONTENT_CLASS_NAME =
  'scroll-fade-y min-h-0 overflow-y-auto overscroll-contain py-4 pr-1 [scrollbar-gutter:stable]';

export interface iSettingsDialogProps {
  isOpen: boolean;
  activeTab: SettingsDialogTab;
  onOpenChange: (isOpen: boolean) => void;
  onTabChange: (tab: SettingsDialogTab) => void;
  selectedTemplateId?: string | null;
}

export function SettingsDialog({
  isOpen,
  activeTab,
  onOpenChange,
  onTabChange,
  selectedTemplateId,
}: iSettingsDialogProps) {
  const {
    generationSettings,
    apiKey,
    connectionHealth,
    updateApiKey,
    updateGenerationSettings,
    updateShouldUseDefaultFieldTemplates,
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
  const {
    isEnhancing: isEnhancingTemplate,
    enhanceTemplate,
    cancelEnhancement: cancelTemplateEnhancement,
  } = useTemplateEnhancement({
    generationSettings,
    apiKey,
    providerKind: connectionHealth.providerKind,
  });

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
            <TabsTrigger value={SETTINGS_DIALOG_TABS.assistant}>Assistant</TabsTrigger>
            <TabsTrigger value={SETTINGS_DIALOG_TABS.templates}>Templates</TabsTrigger>
            <TabsTrigger value={SETTINGS_DIALOG_TABS.examples}>
              Reference Examples {exampleCharacters.length}/{MAX_EXAMPLE_CHARACTER_COUNT}
            </TabsTrigger>
          </TabsList>

          <TabsContent value={SETTINGS_DIALOG_TABS.connection} className={SETTINGS_TAB_CONTENT_CLASS_NAME}>
            <ConnectionSettings
              generationSettings={generationSettings}
              apiKey={apiKey}
              connectionHealth={connectionHealth}
              onApiKeyChange={updateApiKey}
              onHealthCheck={handleHealthCheck}
              onSettingsChange={updateGenerationSettings}
            />
          </TabsContent>

          <TabsContent value={SETTINGS_DIALOG_TABS.sampling} className={SETTINGS_TAB_CONTENT_CLASS_NAME}>
            <SamplingSettings
              generationSettings={generationSettings}
              availableModels={connectionHealth.availableModels}
              detectedContextSize={connectionHealth.detectedContextSize}
              detectedModel={connectionHealth.detectedModel}
              modelContextSizes={connectionHealth.modelContextSizes}
              modelProviders={connectionHealth.modelProviders}
              onSettingsChange={updateGenerationSettings}
            />
          </TabsContent>

          <TabsContent value={SETTINGS_DIALOG_TABS.assistant} className={SETTINGS_TAB_CONTENT_CLASS_NAME}>
            <AssistantEditingSettings
              fieldShouldAllowAssistantEditing={generationSettings.fieldShouldAllowAssistantEditing}
              onChange={(fieldKey, shouldAllowEditing) => {
                updateGenerationSettings({
                  fieldShouldAllowAssistantEditing: {
                    ...generationSettings.fieldShouldAllowAssistantEditing,
                    [fieldKey]: shouldAllowEditing,
                  },
                });
                return undefined;
              }}
            />
          </TabsContent>

          <TabsContent value={SETTINGS_DIALOG_TABS.templates} className={SETTINGS_TAB_CONTENT_CLASS_NAME}>
            <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border px-3 py-2">
              <div className="space-y-1">
                <p className="text-sm font-medium">Use default field templates</p>
                <p className="text-xs text-muted-foreground">
                  Apply built-in structure when a field has no explicit template selection.
                </p>
              </div>
              <Switch
                checked={generationSettings.shouldUseDefaultFieldTemplates}
                aria-label="Use default field templates"
                onCheckedChange={updateShouldUseDefaultFieldTemplates}
              />
            </div>
            <FieldTemplatesPanel
              fieldTemplates={fieldTemplates}
              exampleCharacters={exampleCharacters}
              isEnhancingTemplate={isEnhancingTemplate}
              onAddTemplate={addFieldTemplate}
              onUpdateTemplate={updateFieldTemplate}
              onRemoveTemplate={removeFieldTemplate}
              onDuplicateTemplate={duplicateFieldTemplate}
              onEnhanceTemplate={enhanceTemplate}
              onCancelTemplateEnhancement={cancelTemplateEnhancement}
              selectedTemplateId={selectedTemplateId}
            />
          </TabsContent>

          <TabsContent value={SETTINGS_DIALOG_TABS.examples} className={SETTINGS_TAB_CONTENT_CLASS_NAME}>
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
