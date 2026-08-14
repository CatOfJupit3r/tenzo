import { Tabs, TabsContent, TabsList, TabsTrigger } from '@~/components/ui/tabs';

import { CharacterBookTab } from './character-book-tab';
import { CoreFieldsTab } from './core-fields-tab';
import { DialogueTab } from './dialogue-tab';
import { MetadataTab } from './metadata-tab';
import { PromptOverridesTab } from './prompt-overrides-tab';
import { characterCreatorTabs, CHARACTER_CREATOR_TABS, TAB_TRIGGER_CLASS_NAME } from './tabs.constants';
import type { CharacterCreatorTab } from './tabs.constants';

interface iCharacterCreatorTabsProps {
  activeTab: CharacterCreatorTab;
  onActiveTabChange: (tab: CharacterCreatorTab) => void;
}

export function CharacterCreatorTabs({ activeTab, onActiveTabChange }: iCharacterCreatorTabsProps) {
  return (
    <Tabs
      value={activeTab}
      className="gap-0"
      onValueChange={(value) => onActiveTabChange(characterCreatorTabs.parse(value))}
    >
      <div className="border-b p-3 lg:hidden">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-2 rounded-none bg-transparent p-0 text-foreground">
          <TabsTrigger value={CHARACTER_CREATOR_TABS.core} className={TAB_TRIGGER_CLASS_NAME}>
            Core Fields
          </TabsTrigger>
          <TabsTrigger value={CHARACTER_CREATOR_TABS.dialogue} className={TAB_TRIGGER_CLASS_NAME}>
            Dialogue
          </TabsTrigger>
          <TabsTrigger value={CHARACTER_CREATOR_TABS.character_book} className={TAB_TRIGGER_CLASS_NAME}>
            Character Book
          </TabsTrigger>
          <TabsTrigger value={CHARACTER_CREATOR_TABS.overrides} className={TAB_TRIGGER_CLASS_NAME}>
            Prompt Overrides
          </TabsTrigger>
          <TabsTrigger value={CHARACTER_CREATOR_TABS.metadata} className={TAB_TRIGGER_CLASS_NAME}>
            Metadata
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value={CHARACTER_CREATOR_TABS.core} className="p-4 sm:p-5 xl:p-6">
        <CoreFieldsTab />
      </TabsContent>

      <TabsContent value={CHARACTER_CREATOR_TABS.dialogue} className="p-4 sm:p-5 xl:p-6">
        <DialogueTab />
      </TabsContent>

      <TabsContent value={CHARACTER_CREATOR_TABS.character_book} className="p-4 sm:p-5 xl:p-6">
        <CharacterBookTab />
      </TabsContent>

      <TabsContent value={CHARACTER_CREATOR_TABS.overrides} className="p-4 sm:p-5 xl:p-6">
        <PromptOverridesTab />
      </TabsContent>

      <TabsContent value={CHARACTER_CREATOR_TABS.metadata} className="p-4 sm:p-5 xl:p-6">
        <MetadataTab />
      </TabsContent>
    </Tabs>
  );
}
