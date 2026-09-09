import { em } from 'enumwaii';
import { useMemo, useState } from 'react';
import { LuArchive, LuDatabaseBackup, LuDownload } from 'react-icons/lu';

import { Button } from '@~/components/ui/button';
import { Checkbox } from '@~/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@~/components/ui/dialog';
import { Label } from '@~/components/ui/label';
import type { iOptionType } from '@~/components/ui/select';
import { SingleSelect } from '@~/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@~/components/ui/tabs';
import { BUTTON_VARIANTS } from '@~/components/ui/ui-enums';
import {
  ARCHIVE_FORMAT_ENUM,
  ARCHIVE_FORMAT_LABELS,
  EXPORT_DETAIL_LEVEL_DESCRIPTIONS,
  EXPORT_DETAIL_LEVEL_ENUM,
  EXPORT_DETAIL_LEVEL_LABELS,
} from '@~/features/character-creator/lib/cards/export-settings';

import type { iCharacterLibraryItem } from '../lib/cards/character-library';
import { getCharacterLibraryItemDisplayName } from '../lib/cards/character-library';
import type { ArchiveFormat, iExportSettings } from '../lib/cards/export-settings';

const ACTIVE_EXPORTS_ENUM = em(['JSON', 'PNG', 'BULK', 'ALL']);
const ACTIVE_EXPORTS = ACTIVE_EXPORTS_ENUM.enum;

export interface iExportDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  hasPortrait: boolean;
  characters: iCharacterLibraryItem[];
  exportSettings: iExportSettings;
  onExportSettingsChange: (patch: Partial<iExportSettings>) => void;
  onExportJson: () => Promise<unknown>;
  onExportPng: () => Promise<unknown>;
  onBulkExport: (characterIds: string[]) => Promise<unknown>;
  onExportAll: () => Promise<unknown>;
}

const EXPORT_DIALOG_TABS_ENUM = em(['CURRENT', 'BULK', 'EVERYTHING']);
const EXPORT_DIALOG_TABS = EXPORT_DIALOG_TABS_ENUM.enum;

type ActiveExport = (typeof ACTIVE_EXPORTS_ENUM)['~type'] | null;

const detailLevelOptions: iOptionType[] = EXPORT_DETAIL_LEVEL_ENUM.values.map((detailLevel) => ({
  value: detailLevel,
  label: EXPORT_DETAIL_LEVEL_LABELS.get(detailLevel),
  description: EXPORT_DETAIL_LEVEL_DESCRIPTIONS.get(detailLevel),
}));

const archiveFormatOptions: iOptionType[] = ARCHIVE_FORMAT_ENUM.values.map((archiveFormat) => ({
  value: archiveFormat,
  label: ARCHIVE_FORMAT_LABELS.get(archiveFormat),
}));

function ArchiveFormatSelect({
  value,
  onValueChange,
  inputId,
}: {
  value: ArchiveFormat;
  onValueChange: (value: ArchiveFormat) => unknown;
  inputId: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId}>Archive format</Label>
      <SingleSelect
        inputId={inputId}
        options={archiveFormatOptions}
        value={value}
        onValueChange={(nextValue) => {
          if (nextValue) {
            onValueChange(ARCHIVE_FORMAT_ENUM.parse(nextValue));
          }
        }}
      />
      <p className="text-sm text-muted-foreground">
        RAR is not offered because the format is proprietary and cannot be created in the browser.
      </p>
    </div>
  );
}

export function ExportDialog({
  isOpen,
  onOpenChange,
  hasPortrait,
  characters,
  exportSettings,
  onExportSettingsChange,
  onExportJson,
  onExportPng,
  onBulkExport,
  onExportAll,
}: iExportDialogProps) {
  const [activeExport, setActiveExport] = useState<ActiveExport>(null);
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<Record<string, boolean>>({});

  const selectedIds = useMemo(
    () => characters.map((character) => character.id).filter((id) => selectedCharacterIds[id]),
    [characters, selectedCharacterIds],
  );
  const isAllSelected = characters.length > 0 && selectedIds.length === characters.length;

  const runExport = async (kind: Exclude<ActiveExport, null>, exportAction: () => Promise<unknown>) => {
    setActiveExport(kind);
    try {
      await exportAction();
    } finally {
      setActiveExport(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export</DialogTitle>
          <DialogDescription>
            Everything is packaged locally in your browser; no data is sent to a server.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="export-detail-level">Included data</Label>
          <SingleSelect
            inputId="export-detail-level"
            options={detailLevelOptions}
            value={exportSettings.detailLevel}
            onValueChange={(value) => {
              if (value) {
                onExportSettingsChange({ detailLevel: EXPORT_DETAIL_LEVEL_ENUM.parse(value) });
              }
            }}
          />
          <p className="text-sm text-muted-foreground">
            {EXPORT_DETAIL_LEVEL_DESCRIPTIONS.get(exportSettings.detailLevel)}
          </p>
        </div>

        <Tabs defaultValue={EXPORT_DIALOG_TABS.CURRENT}>
          <TabsList className="w-full">
            <TabsTrigger value={EXPORT_DIALOG_TABS.CURRENT}>Current character</TabsTrigger>
            <TabsTrigger value={EXPORT_DIALOG_TABS.BULK}>Multiple characters</TabsTrigger>
            <TabsTrigger value={EXPORT_DIALOG_TABS.EVERYTHING}>Everything</TabsTrigger>
          </TabsList>

          <TabsContent className="space-y-4 pt-2" value={EXPORT_DIALOG_TABS.CURRENT}>
            <div className="space-y-3 rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
              <p>JSON export writes the hybrid V1+V2 format. PNG export embeds the same JSON into a `chara` chunk.</p>
              <p>
                {hasPortrait ? 'PNG export will use the stored portrait image.' : 'PNG export needs a portrait image.'}
              </p>
            </div>

            <DialogFooter>
              <Button
                disabled={activeExport !== null}
                type="button"
                variant={BUTTON_VARIANTS.OUTLINE}
                onClick={async () => runExport(ACTIVE_EXPORTS.JSON, onExportJson)}
              >
                <LuDownload className="size-4" />
                {activeExport === ACTIVE_EXPORTS.JSON ? 'Exporting JSON...' : 'Download JSON'}
              </Button>
              <Button
                disabled={!hasPortrait || activeExport !== null}
                type="button"
                onClick={async () => runExport(ACTIVE_EXPORTS.PNG, onExportPng)}
              >
                <LuDownload className="size-4" />
                {activeExport === ACTIVE_EXPORTS.PNG ? 'Exporting PNG...' : 'Download PNG'}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent className="space-y-4 pt-2" value={EXPORT_DIALOG_TABS.BULK}>
            <ArchiveFormatSelect
              inputId="bulk-archive-format"
              value={exportSettings.archiveFormat}
              onValueChange={(archiveFormat) => onExportSettingsChange({ archiveFormat })}
            />

            <div className="rounded-xl border">
              <label className="flex items-center gap-3 border-b bg-muted/20 px-4 py-2.5 text-sm font-medium">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={(checked) => {
                    setSelectedCharacterIds(
                      checked === true ? Object.fromEntries(characters.map((character) => [character.id, true])) : {},
                    );
                  }}
                />
                Select all ({characters.length})
              </label>
              <div className="max-h-56 space-y-1 overflow-y-auto p-2">
                {characters.map((character) => (
                  <label
                    key={character.id}
                    className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted/30"
                  >
                    <Checkbox
                      checked={Boolean(selectedCharacterIds[character.id])}
                      onCheckedChange={(checked) => {
                        setSelectedCharacterIds((previousSelection) => ({
                          ...previousSelection,
                          [character.id]: checked === true,
                        }));
                      }}
                    />
                    <span className="min-w-0 truncate">{getCharacterLibraryItemDisplayName(character)}</span>
                    {character.portrait ? (
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">PNG</span>
                    ) : (
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">JSON</span>
                    )}
                  </label>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button
                disabled={selectedIds.length === 0 || activeExport !== null}
                type="button"
                onClick={async () => runExport(ACTIVE_EXPORTS.BULK, async () => onBulkExport(selectedIds))}
              >
                <LuArchive className="size-4" />
                {activeExport === ACTIVE_EXPORTS.BULK
                  ? 'Building archive...'
                  : `Export ${selectedIds.length || 'selected'} as archive`}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent className="space-y-4 pt-2" value={EXPORT_DIALOG_TABS.EVERYTHING}>
            <ArchiveFormatSelect
              inputId="backup-archive-format"
              value={exportSettings.archiveFormat}
              onValueChange={(archiveFormat) => onExportSettingsChange({ archiveFormat })}
            />

            <div className="space-y-3 rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
              <p>
                The backup bundles every saved character, portrait image, reference example, and generation settings.
                Import it back through the Import dialog to restore this library on any device.
              </p>
              <p>Your API key is never included in the backup.</p>
            </div>

            <DialogFooter>
              <Button
                disabled={activeExport !== null}
                type="button"
                onClick={async () => runExport(ACTIVE_EXPORTS.ALL, onExportAll)}
              >
                <LuDatabaseBackup className="size-4" />
                {activeExport === ACTIVE_EXPORTS.ALL ? 'Building backup...' : 'Export full backup'}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
