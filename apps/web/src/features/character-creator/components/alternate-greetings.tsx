import type { ChangeEvent } from 'react';
import { LuChevronDown, LuChevronUp, LuPlus, LuTrash2 } from 'react-icons/lu';

import { Button } from '@~/components/ui/button';
import { Textarea } from '@~/components/ui/textarea';

export interface iAlternateGreetingsProps {
  greetings: string[];
  onAdd: () => void;
  onChange: (index: number, value: string) => void;
  onRemove: (index: number) => void;
  onMove: (fromIndex: number, toIndex: number) => void;
}

export function AlternateGreetings({ greetings, onAdd, onChange, onRemove, onMove }: iAlternateGreetingsProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm leading-none font-medium">Alternate Greetings</span>
        <Button type="button" variant="outline" size="sm" onClick={onAdd}>
          <LuPlus className="size-4" />
          Add greeting
        </Button>
      </div>

      {greetings.length === 0 ? (
        <p className="text-sm text-muted-foreground">No alternate greetings yet.</p>
      ) : (
        <div className="space-y-3">
          {greetings.map((greeting, index) => (
            // eslint-disable-next-line react/no-array-index-key
            <div key={index} className="flex gap-2 rounded-md border p-3">
              <Textarea
                aria-label={`Alternate greeting ${index + 1}`}
                value={greeting}
                rows={4}
                className="flex-1"
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange(index, event.target.value)}
              />
              <div className="flex flex-col gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={index === 0}
                  tooltip="Move up"
                  onClick={() => onMove(index, index - 1)}
                >
                  <LuChevronUp className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={index === greetings.length - 1}
                  tooltip="Move down"
                  onClick={() => onMove(index, index + 1)}
                >
                  <LuChevronDown className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  tooltip="Remove greeting"
                  onClick={() => onRemove(index)}
                >
                  <LuTrash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
