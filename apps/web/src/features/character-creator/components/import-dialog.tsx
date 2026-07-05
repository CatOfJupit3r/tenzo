import type { ChangeEvent, DragEvent } from 'react';
import { useCallback, useRef, useState } from 'react';
import { LuFileUp } from 'react-icons/lu';

import { Button } from '@~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@~/components/ui/dialog';
import { cn } from '@~/lib/utils';

export interface iImportDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onImportFile: (file: File) => Promise<unknown>;
}

export function ImportDialog({ isOpen, onOpenChange, onImportFile }: iImportDialogProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleImport = useCallback(
    async (file: File | undefined) => {
      if (!file) {
        return;
      }

      setIsImporting(true);

      try {
        await onImportFile(file);
        onOpenChange(false);
      } finally {
        setIsImporting(false);
      }
    },
    [onImportFile, onOpenChange],
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Character Card</DialogTitle>
          <DialogDescription>
            Drop a PNG or JSON card here, or choose a file manually. PNG imports keep the original portrait image.
          </DialogDescription>
        </DialogHeader>

        <button
          className={cn(
            'flex min-h-56 w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center transition-colors',
            isDraggingOver ? 'border-foreground/50 bg-muted/50' : null,
          )}
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragEnter={(event: DragEvent<HTMLButtonElement>) => {
            event.preventDefault();
            setIsDraggingOver(true);
          }}
          onDragOver={(event: DragEvent<HTMLButtonElement>) => {
            event.preventDefault();
            setIsDraggingOver(true);
          }}
          onDragLeave={(event: DragEvent<HTMLButtonElement>) => {
            event.preventDefault();
            setIsDraggingOver(false);
          }}
          onDrop={async (event: DragEvent<HTMLButtonElement>) => {
            event.preventDefault();
            setIsDraggingOver(false);
            const droppedFile = event.dataTransfer.files?.[0];
            await handleImport(droppedFile);
          }}
        >
          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            accept=".json,.png,application/json,image/png"
            onChange={async (event: ChangeEvent<HTMLInputElement>) => {
              const selectedFile = event.target.files?.[0];
              await handleImport(selectedFile);
              event.target.value = '';
            }}
          />
          <LuFileUp className="size-6" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Drop card file to import</p>
            <p className="text-sm text-muted-foreground">
              Accepted formats: PNG with embedded metadata, or standalone JSON.
            </p>
          </div>
        </button>

        <DialogFooter>
          <Button disabled={isImporting} type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={isImporting} type="button" onClick={() => inputRef.current?.click()}>
            {isImporting ? 'Importing...' : 'Choose file'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
