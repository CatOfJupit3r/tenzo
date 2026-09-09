import { em } from 'enumwaii';
import { z } from 'zod';

import { CHARACTER_FIELD_KEY_ENUM, CHARACTER_FIELD_KEYS } from '@~/features/character-creator/lib/cards/card-schema';

export const DIALOGUE_FIELD_ENUM = CHARACTER_FIELD_KEY_ENUM.pick([
  CHARACTER_FIELD_KEYS.FIRST_MES,
  CHARACTER_FIELD_KEYS.MES_EXAMPLE,
]);

export const characterCreatorTabsEnum = em(['CORE', 'DIALOGUE', 'CHARACTER_BOOK', 'OVERRIDES', 'METADATA']);
export const CHARACTER_CREATOR_TABS = characterCreatorTabsEnum.enum;
export const characterCreatorTabs = z.enum(CHARACTER_CREATOR_TABS);

export type CharacterCreatorTab = z.infer<typeof characterCreatorTabs>;

export const FIELD_PANEL_CLASS_NAME = 'rounded-2xl border bg-card/70 p-4 shadow-sm';

export const TAB_TRIGGER_CLASS_NAME =
  'h-10 flex-none rounded-full border bg-background px-4 data-[state=active]:border-border data-[state=active]:bg-card';
