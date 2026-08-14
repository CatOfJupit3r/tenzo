import {
  LuBookOpen,
  LuChevronLeft,
  LuChevronRight,
  LuMessageCircle,
  LuSlidersHorizontal,
  LuTags,
  LuUserRound,
} from 'react-icons/lu';

import { Button } from '@~/components/ui/button/button';
import { cn } from '@~/lib/utils';

import { ResizablePanelHandle } from './resizable-panel-handle';
import { CHARACTER_CREATOR_TABS } from './tabs/tabs.constants';
import type { CharacterCreatorTab } from './tabs/tabs.constants';
import { WORKSPACE_PANEL_WIDTHS } from './workspace-panel-layout';

const SECTION_ITEMS = [
  { value: CHARACTER_CREATOR_TABS.core, label: 'Core Fields', Icon: LuUserRound },
  { value: CHARACTER_CREATOR_TABS.dialogue, label: 'Dialogue', Icon: LuMessageCircle },
  { value: CHARACTER_CREATOR_TABS.character_book, label: 'Character Book', Icon: LuBookOpen },
  { value: CHARACTER_CREATOR_TABS.overrides, label: 'Prompt Overrides', Icon: LuSlidersHorizontal },
  { value: CHARACTER_CREATOR_TABS.metadata, label: 'Metadata', Icon: LuTags },
] satisfies Array<{ value: CharacterCreatorTab; label: string; Icon: typeof LuUserRound }>;

interface iCharacterSectionPanelProps {
  activeTab: CharacterCreatorTab;
  isCollapsed: boolean;
  isCollapseLocked?: boolean;
  onActiveTabChange: (tab: CharacterCreatorTab) => void;
  onCollapsedChange: (isCollapsed: boolean) => void;
  onWidthChange: (width: number) => void;
  width: number;
}

export function CharacterSectionPanel({
  activeTab,
  isCollapsed,
  isCollapseLocked = false,
  onActiveTabChange,
  onCollapsedChange,
  onWidthChange,
  width,
}: iCharacterSectionPanelProps) {
  const renderedWidth = isCollapsed ? WORKSPACE_PANEL_WIDTHS.section.collapsed : width;

  return (
    <div className="relative hidden min-h-0 shrink-0 lg:flex">
      <aside
        aria-label="Character sections"
        className="flex h-full min-h-0 flex-col border-r bg-card/35"
        style={{ width: renderedWidth }}
      >
        <div className={cn('flex h-12 items-center border-b px-2', isCollapsed ? 'justify-center' : 'justify-between')}>
          {!isCollapsed ? (
            <p className="px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Sections</p>
          ) : null}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={isCollapsed ? 'Expand section panel' : 'Collapse section panel'}
            aria-expanded={!isCollapsed}
            disabled={isCollapseLocked}
            title={isCollapseLocked ? 'Sections stay compact while Library and Assistant are both open' : undefined}
            onClick={() => onCollapsedChange(!isCollapsed)}
          >
            {isCollapsed ? <LuChevronRight className="size-4" /> : <LuChevronLeft className="size-4" />}
          </Button>
        </div>
        <div className="grid gap-1 p-2">
          {SECTION_ITEMS.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              title={isCollapsed ? label : undefined}
              aria-current={activeTab === value ? 'page' : undefined}
              className={cn(
                'flex h-11 items-center rounded-lg text-sm transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                isCollapsed ? 'justify-center px-0' : 'gap-3 px-3 text-left',
                activeTab === value
                  ? 'bg-primary/10 font-medium text-foreground ring-1 ring-primary/30'
                  : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
              )}
              onClick={() => onActiveTabChange(value)}
            >
              <Icon className="size-4 shrink-0" />
              {!isCollapsed ? <span className="truncate">{label}</span> : <span className="sr-only">{label}</span>}
            </button>
          ))}
        </div>
      </aside>
      {!isCollapsed ? (
        <ResizablePanelHandle
          ariaLabel="Resize section panel"
          direction={1}
          minWidth={WORKSPACE_PANEL_WIDTHS.section.min}
          maxWidth={WORKSPACE_PANEL_WIDTHS.section.max}
          width={width}
          onWidthChange={onWidthChange}
        />
      ) : null}
    </div>
  );
}
