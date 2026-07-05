import type { ChangeEvent } from 'react';
import { LuChevronDown, LuChevronUp, LuPlus, LuTrash2 } from 'react-icons/lu';

import { Button } from '@~/components/ui/button';
import { Textarea } from '@~/components/ui/textarea';

import { FieldGenerationControls } from './field-generation-controls';

interface iAlternateGreetingGenerationState {
  shouldUseGeneralCharacterIdea: boolean;
  instructionValue: string;
  errorMessage?: string | null;
  isGenerating: boolean;
}

export interface iAlternateGreetingsProps {
  greetings: string[];
  generationStates: iAlternateGreetingGenerationState[];
  onAdd: () => void;
  onChange: (index: number, value: string) => void;
  onRemove: (index: number) => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  onShouldUseGeneralCharacterIdeaChange: (index: number, value: boolean) => void;
  onInstructionChange: (index: number, value: string) => void;
  onGenerate: (index: number) => void;
  onContinue: (index: number) => void;
  onCancel: (index: number) => void;
}

export function AlternateGreetings({
  greetings,
  generationStates,
  onAdd,
  onChange,
  onRemove,
  onMove,
  onShouldUseGeneralCharacterIdeaChange,
  onInstructionChange,
  onGenerate,
  onContinue,
  onCancel,
}: iAlternateGreetingsProps) {
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
            <div key={index} className="space-y-3 rounded-md border p-3">
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm font-medium">Greeting {index + 1}</span>
                <div className="flex gap-1">
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

              <FieldGenerationControls
                fieldId={`alternate-greeting-${index}`}
                label={`Alternate Greeting ${index + 1}`}
                shouldUseGeneralCharacterIdea={generationStates[index]?.shouldUseGeneralCharacterIdea ?? true}
                instructionValue={generationStates[index]?.instructionValue ?? ''}
                errorMessage={generationStates[index]?.errorMessage ?? null}
                hasExistingValue={greeting.trim().length > 0}
                isGenerating={generationStates[index]?.isGenerating ?? false}
                onShouldUseGeneralCharacterIdeaChange={(value) => onShouldUseGeneralCharacterIdeaChange(index, value)}
                onInstructionChange={(value) => onInstructionChange(index, value)}
                onGenerate={() => onGenerate(index)}
                onContinue={() => onContinue(index)}
                onCancel={() => onCancel(index)}
              />

              <Textarea
                aria-label={`Alternate greeting ${index + 1}`}
                value={greeting}
                rows={4}
                className="flex-1"
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange(index, event.target.value)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
