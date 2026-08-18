import type { iFieldGenerationState } from '../hooks/use-character-creator-page';
import type {
  iCreateStoredFieldTemplateInput,
  iFieldTemplateViewModel,
  TemplateFieldKey,
} from '../lib/cards/field-templates';
import type { iFieldGenerationControlsProps } from './field-generation-controls';

export interface iFieldGenerationControlBindings {
  fieldId: string;
  label: string;
  fieldValue: string;
  templateFieldKey: TemplateFieldKey;
  generationState: iFieldGenerationState | undefined;
  templateOptions: iFieldTemplateViewModel[];
  onTemplateIdChange: (templateId: string | null) => void;
  onSaveTemplate: (input: iCreateStoredFieldTemplateInput) => void;
  onShouldUseGeneralCharacterIdeaChange: (value: boolean) => void;
  onInstructionChange: (value: string) => void;
  onGenerate: () => void;
  onContinue: () => void;
  onRewrite: () => void;
  onRevertRewrite: () => void;
  onCancel: () => void;
}

export function buildFieldGenerationControlProps({
  fieldId,
  label,
  fieldValue,
  templateFieldKey,
  generationState,
  templateOptions,
  onTemplateIdChange,
  onSaveTemplate,
  onShouldUseGeneralCharacterIdeaChange,
  onInstructionChange,
  onGenerate,
  onContinue,
  onRewrite,
  onRevertRewrite,
  onCancel,
}: iFieldGenerationControlBindings): iFieldGenerationControlsProps {
  return {
    fieldId,
    label,
    shouldUseGeneralCharacterIdea: generationState?.shouldUseGeneralCharacterIdea ?? true,
    instructionValue: generationState?.instructionValue ?? '',
    errorMessage: generationState?.errorMessage ?? null,
    hasExistingValue: fieldValue.trim().length > 0,
    hasRewriteBackup: generationState?.hasRewriteBackup ?? false,
    isGenerating: generationState?.isGenerating ?? false,
    templateOptions,
    templateId: generationState?.templateId ?? null,
    isDefaultTemplateSelected: generationState?.isDefaultTemplateSelected ?? false,
    isExplicitTemplateNone: generationState?.isExplicitTemplateNone ?? false,
    isStrictTemplateSelected: generationState?.isStrictTemplateSelected ?? false,
    fieldValue,
    templateFieldKey,
    onTemplateIdChange,
    onSaveTemplate,
    onShouldUseGeneralCharacterIdeaChange,
    onInstructionChange,
    onGenerate,
    onContinue,
    onRewrite,
    onRevertRewrite,
    onCancel,
  };
}
