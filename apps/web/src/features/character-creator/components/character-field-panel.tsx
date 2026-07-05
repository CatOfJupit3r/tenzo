import { cn } from '@~/lib/utils';

import { useCharacterCreatorContext } from '../context/character-creator-context/character-creator-context.hooks';
import type { CharacterTextFieldKey } from '../lib/card-schema';
import { CharacterField } from './character-field';
import { FIELD_PANEL_CLASS_NAME } from './tabs/tabs.constants';

interface iCharacterFieldConfig {
  key: CharacterTextFieldKey;
  label: string;
  rows?: number;
  hint?: string;
}

interface iCharacterFieldPanelProps {
  config: iCharacterFieldConfig;
  isWide?: boolean;
}

export function CharacterFieldPanel({ config, isWide }: iCharacterFieldPanelProps) {
  const {
    data,
    updateField,
    getStandardFieldGenerationState,
    generateStandardField,
    cancelStandardFieldGeneration,
    updateStandardFieldShouldUseGeneralCharacterIdea,
    updateStandardFieldInstruction,
  } = useCharacterCreatorContext();
  const generationState = getStandardFieldGenerationState(config.key);

  return (
    <div className={cn(FIELD_PANEL_CLASS_NAME, isWide ? 'xl:col-span-2' : null)}>
      <CharacterField
        fieldId={`character-${config.key}`}
        label={config.label}
        value={data[config.key]}
        rows={config.rows}
        hint={config.hint}
        shouldUseGeneralCharacterIdea={generationState.shouldUseGeneralCharacterIdea}
        instructionValue={generationState.instructionValue}
        generationErrorMessage={generationState.errorMessage}
        isGenerating={generationState.isGenerating}
        onValueChange={(value) => updateField(config.key, value)}
        onShouldUseGeneralCharacterIdeaChange={(value) =>
          updateStandardFieldShouldUseGeneralCharacterIdea(config.key, value)
        }
        onInstructionChange={(value) => updateStandardFieldInstruction(config.key, value)}
        onGenerate={() => {
          void generateStandardField(config.key, config.label);
        }}
        onContinue={() => {
          void generateStandardField(config.key, config.label, true);
        }}
        onCancel={() => cancelStandardFieldGeneration(config.key)}
      />
    </div>
  );
}
