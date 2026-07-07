import { z } from 'zod';

export const characterCreatorTabs = z.enum(['core', 'dialogue', 'agent', 'revise', 'overrides', 'metadata']);
export const CHARACTER_CREATOR_TABS = characterCreatorTabs.enum;

export const FIELD_PANEL_CLASS_NAME = 'rounded-2xl border bg-card/70 p-4 shadow-sm';

export const TAB_TRIGGER_CLASS_NAME =
  'h-10 flex-none rounded-full border bg-background px-4 data-[state=active]:border-border data-[state=active]:bg-card';
