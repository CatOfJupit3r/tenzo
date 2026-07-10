import { toastError } from '@~/components/toastifications/create-jsx-toasts';
import { cn } from '@~/lib/utils';

import type { iCharacterFieldConfig } from '../constants/field-config';
import { useCharacterAssistant } from '../context/character-assistant-context.hooks';
import { useCharacterCreatorContext } from '../context/character-creator-context/character-creator-context.hooks';
import { getTemplateFieldKeyForTargetKey } from '../lib/field-templates';
import { GENERATION_MODES } from '../lib/prompt/generation-contracts';
import { CharacterField } from './character-field';
import { FIELD_PANEL_CLASS_NAME } from './tabs/tabs.constants';

interface iCharacterFieldPanelProps {
  config: iCharacterFieldConfig;
  isWide?: boolean;
}

export function CharacterFieldPanel({ config, isWide }: iCharacterFieldPanelProps) {
  const { openAssistantForField, workspace } = useCharacterAssistant();
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
    updateStandardFieldTemplateId,
    getTemplateOptionsForTargetKey,
    addFieldTemplate,
  } = useCharacterCreatorContext();
  const generationState = getStandardFieldGenerationState(config.key);
  const templateFieldKey = getTemplateFieldKeyForTargetKey(`field:${config.key}`);
  const assistantPatchView = workspace.activePatches.find(
    (patchView) => patchView.patch.fieldKey === config.key && patchView.patch.kind === 'text',
  );

  const reportAssistantError = (error: unknown) => {
    toastError('Assistant proposal was not updated', error instanceof Error ? error.message : 'The action failed.');
  };

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
        templateOptions={getTemplateOptionsForTargetKey(`field:${config.key}`)}
        templateId={generationState.templateId}
        isStrictTemplateSelected={generationState.isStrictTemplateSelected}
        templateFieldKey={templateFieldKey}
        onTemplateIdChange={(templateId) => updateStandardFieldTemplateId(config.key, templateId)}
        onSaveTemplate={templateFieldKey ? addFieldTemplate : undefined}
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
        onAskAssistant={() => openAssistantForField(config.key)}
        assistantPatch={assistantPatchView?.patch.kind === 'text' ? assistantPatchView.patch : null}
        onApplyAssistantProposal={
          assistantPatchView
            ? (resolvedValue) => {
                void workspace
                  .applyProposalFields(assistantPatchView.proposalId, [config.key], resolvedValue)
                  .catch(reportAssistantError);
              }
            : undefined
        }
        onRejectAssistantProposal={
          assistantPatchView
            ? () => {
                void workspace
                  .rejectProposalFields(assistantPatchView.proposalId, [config.key])
                  .catch(reportAssistantError);
              }
            : undefined
        }
      />
    </div>
  );
}
