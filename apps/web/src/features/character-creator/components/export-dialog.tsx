import { useState } from 'react';
import { LuDownload } from 'react-icons/lu';

import { Button } from '@~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@~/components/ui/dialog';

export interface iExportDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  hasPortrait: boolean;
  onExportJson: () => Promise<unknown>;
  onExportPng: () => Promise<unknown>;
}

export function ExportDialog({ isOpen, onOpenChange, hasPortrait, onExportJson, onExportPng }: iExportDialogProps) {
  const [activeExport, setActiveExport] = useState<'json' | 'png' | null>(null);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Character Card</DialogTitle>
          <DialogDescription>
            JSON export writes the hybrid V1+V2 format. PNG export embeds the same JSON into a fresh `chara` text chunk.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
          <p>JSON export is always available.</p>
          <p>{hasPortrait ? 'PNG export will use the stored portrait image.' : 'PNG export needs a portrait image.'}</p>
        </div>

        <DialogFooter>
          <Button
            disabled={activeExport !== null}
            type="button"
            variant="outline"
            onClick={async () => {
              setActiveExport('json');
              try {
                await onExportJson();
              } finally {
                setActiveExport(null);
              }
            }}
          >
            <LuDownload className="size-4" />
            {activeExport === 'json' ? 'Exporting JSON...' : 'Download JSON'}
          </Button>
          <Button
            disabled={!hasPortrait || activeExport !== null}
            type="button"
            onClick={async () => {
              setActiveExport('png');
              try {
                await onExportPng();
              } finally {
                setActiveExport(null);
              }
            }}
          >
            <LuDownload className="size-4" />
            {activeExport === 'png' ? 'Exporting PNG...' : 'Download PNG'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
