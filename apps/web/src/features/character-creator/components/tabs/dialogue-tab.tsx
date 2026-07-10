import { toastError } from '@~/components/toastifications/create-jsx-toasts';

import { CORE_FIELD_CONFIGS } from '../../constants/field-config';
import { useCharacterAssistant } from '../../context/character-assistant-context.hooks';
import { useCharacterCreatorContext } from '../../context/character-creator-context/character-creator-context.hooks';
import { CHARACTER_EDIT_FIELD_KEYS } from '../../lib/character-edit-proposal';
import { TEMPLATE_FIELD_KEYS } from '../../lib/field-templates';
import { GENERATION_MODES } from '../../lib/prompt/generation-contracts';
import { AlternateGreetings } from '../alternate-greetings';
import { CharacterAssistantStructuredReview } from '../character-assistant-structured-review';
import { CharacterFieldPanel } from '../character-field-panel';
import { FIELD_PANEL_CLASS_NAME } from './tabs.constants';

const DIALOGUE_FIELD_KEYS = new Set(['first_mes', 'mes_example']);

export function DialogueTab() {
  const { openAssistantForField, workspace } = useCharacterAssistant();
  const {
    data,
    addGreeting,
    updateGreeting,
    handleRemoveGreeting,
    handleReorderGreetings,
    greetingGenerationStates,
    updateAlternateGreetingShouldUseGeneralCharacterIdea,
    updateAlternateGreetingInstruction,
    updateAlternateGreetingTemplateId,
    getTemplatesForField,
    addFieldTemplate,
    generateAlternateGreeting,
    cancelAlternateGreetingGeneration,
    revertAlternateGreetingRewrite,
    resolveAlternateGreetingRewriteReview,
    acceptAlternateGreetingRewrite,
  } = useCharacterCreatorContext();
  const assistantPatchView = workspace.activePatches.find(
    (patchView) => patchView.patch.fieldKey === CHARACTER_EDIT_FIELD_KEYS.alternate_greetings,
  );
  const reportAssistantError = (error: unknown) =>
    toastError('Assistant proposal was not updated', error instanceof Error ? error.message : 'The action failed.');

  return (
    <div className="space-y-4">
      {CORE_FIELD_CONFIGS.filter((config) => DIALOGUE_FIELD_KEYS.has(config.key)).map((config) => (
        <CharacterFieldPanel key={config.key} config={config} />
      ))}

      <div className={FIELD_PANEL_CLASS_NAME}>
        {assistantPatchView?.patch.kind === 'string-list' ? (
          <div className="mb-4">
            <CharacterAssistantStructuredReview
              patch={assistantPatchView.patch}
              onApply={() => {
                void workspace
                  .applyProposalFields(assistantPatchView.proposalId, [CHARACTER_EDIT_FIELD_KEYS.alternate_greetings])
                  .catch(reportAssistantError);
              }}
              onReject={() => {
                void workspace
                  .rejectProposalFields(assistantPatchView.proposalId, [CHARACTER_EDIT_FIELD_KEYS.alternate_greetings])
                  .catch(reportAssistantError);
              }}
            />
          </div>
        ) : null}
        <AlternateGreetings
          greetings={data.alternate_greetings}
          generationStates={greetingGenerationStates}
          templateOptions={getTemplatesForField(TEMPLATE_FIELD_KEYS.alternate_greeting)}
          onAdd={addGreeting}
          onChange={updateGreeting}
          onRemove={handleRemoveGreeting}
          onMove={handleReorderGreetings}
          onTemplateIdChange={updateAlternateGreetingTemplateId}
          onSaveTemplate={addFieldTemplate}
          onShouldUseGeneralCharacterIdeaChange={updateAlternateGreetingShouldUseGeneralCharacterIdea}
          onInstructionChange={updateAlternateGreetingInstruction}
          onGenerate={(index) => {
            void generateAlternateGreeting(index);
          }}
          onContinue={(index) => {
            void generateAlternateGreeting(index, GENERATION_MODES.continue);
          }}
          onRewrite={(index) => {
            void generateAlternateGreeting(index, GENERATION_MODES.rewrite);
          }}
          onRevertRewrite={revertAlternateGreetingRewrite}
          onAcceptRewrite={acceptAlternateGreetingRewrite}
          onResolveRewriteReview={resolveAlternateGreetingRewriteReview}
          onCancel={cancelAlternateGreetingGeneration}
          onAskAssistant={() => openAssistantForField(CHARACTER_EDIT_FIELD_KEYS.alternate_greetings)}
        />
      </div>
    </div>
  );
}
