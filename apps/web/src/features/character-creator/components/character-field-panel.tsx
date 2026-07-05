import { cn } from '@~/lib/utils';

import type { iCharacterFieldConfig } from '../constants/field-config';
import { useCharacterCreatorContext } from '../context/character-creator-context/character-creator-context.hooks';
import { GENERATION_MODES } from '../lib/prompt-builder';
import { CharacterField } from './character-field';
import { FIELD_PANEL_CLASS_NAME } from './tabs/tabs.constants';

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
    revertStandardFieldRewrite,
    resolveStandardFieldRewriteReview,
    acceptStandardFieldRewrite,
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
        editorVariant={config.editorVariant}
        doesAllowOriginalMacro={config.doesAllowOriginalMacro}
        shouldUseGeneralCharacterIdea={generationState.shouldUseGeneralCharacterIdea}
        instructionValue={generationState.instructionValue}
        generationErrorMessage={generationState.errorMessage}
        isGenerating={generationState.isGenerating}
        hasRewriteBackup={generationState.hasRewriteBackup}
        isRewriteReviewPending={generationState.isRewriteReviewPending}
        rewriteBackupValue={generationState.rewriteBackupValue}
        onValueChange={(value) => updateField(config.key, value)}
        onShouldUseGeneralCharacterIdeaChange={(value) =>
          updateStandardFieldShouldUseGeneralCharacterIdea(config.key, value)
        }
        onInstructionChange={(value) => updateStandardFieldInstruction(config.key, value)}
        onGenerate={() => {
          void generateStandardField(config.key, config.label);
        }}
        onContinue={() => {
          void generateStandardField(config.key, config.label, GENERATION_MODES.continue);
        }}
        onRewrite={() => {
          void generateStandardField(config.key, config.label, GENERATION_MODES.rewrite);
        }}
        onRevertRewrite={() => revertStandardFieldRewrite(config.key)}
        onAcceptRewrite={() => acceptStandardFieldRewrite(config.key)}
        onResolveRewriteReview={(mergedValue) => resolveStandardFieldRewriteReview(config.key, mergedValue)}
        onCancel={() => cancelStandardFieldGeneration(config.key)}
      />
    </div>
  );
}
