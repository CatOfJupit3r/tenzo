import { Card } from '@~/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@~/components/ui/tabs';

import { CoreFieldsTab } from './core-fields-tab';
import { DialogueTab } from './dialogue-tab';
import { MetadataTab } from './metadata-tab';
import { PromptOverridesTab } from './prompt-overrides-tab';
import { CHARACTER_CREATOR_TABS, TAB_TRIGGER_CLASS_NAME } from './tabs.constants';

export function CharacterCreatorTabs() {
  return (
    <Tabs defaultValue={CHARACTER_CREATOR_TABS.core} className="gap-4">
      <Card className="gap-0 overflow-hidden bg-card/95 py-0 shadow-sm">
        <div className="border-b p-4 sm:px-6">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-2 rounded-none bg-transparent p-0 text-foreground">
            <TabsTrigger value={CHARACTER_CREATOR_TABS.core} className={TAB_TRIGGER_CLASS_NAME}>
              Core Fields
            </TabsTrigger>
            <TabsTrigger value={CHARACTER_CREATOR_TABS.dialogue} className={TAB_TRIGGER_CLASS_NAME}>
              Dialogue
            </TabsTrigger>
            <TabsTrigger value={CHARACTER_CREATOR_TABS.overrides} className={TAB_TRIGGER_CLASS_NAME}>
              Prompt Overrides
            </TabsTrigger>
            <TabsTrigger value={CHARACTER_CREATOR_TABS.metadata} className={TAB_TRIGGER_CLASS_NAME}>
              Metadata
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value={CHARACTER_CREATOR_TABS.core} className="p-4 sm:p-6">
          <CoreFieldsTab />
        </TabsContent>

        <TabsContent value={CHARACTER_CREATOR_TABS.dialogue} className="p-4 sm:p-6">
          <DialogueTab />
        </TabsContent>

        <TabsContent value={CHARACTER_CREATOR_TABS.overrides} className="p-4 sm:p-6">
          <PromptOverridesTab />
        </TabsContent>

        <TabsContent value={CHARACTER_CREATOR_TABS.metadata} className="p-4 sm:p-6">
          <MetadataTab />
        </TabsContent>
      </Card>
    </Tabs>
  );
}
