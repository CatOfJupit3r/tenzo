import { toastError } from '@~/components/toastifications/create-jsx-toasts';
import {
  CHARACTER_EDIT_FIELD_KEYS,
  CHARACTER_EDIT_PATCH_KINDS_CASES,
} from '@~/features/character-creator/lib/proposals/character-edit-proposal';

import { CORE_FIELD_CONFIGS } from '../../constants/field-config';
import { useCharacterAssistant } from '../../context/character-assistant-context.hooks';
import { useCharacterCreatorContext } from '../../context/character-creator-context/character-creator-context.hooks';
import { TEMPLATE_FIELD_KEYS } from '../../lib/cards/field-templates';
import { GENERATION_MODES } from '../../lib/prompt/generation-contracts';
import { AlternateGreetings } from '../alternate-greetings';
import { CharacterAssistantStructuredReview } from '../character-assistant-structured-review';
import { CharacterFieldPanel } from '../character-field-panel';
import { DIALOGUE_FIELD_ENUM, FIELD_PANEL_CLASS_NAME } from './tabs.constants';

export function DialogueTab() {
  const { workspace } = useCharacterAssistant();
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
    (patchView) => patchView.patch.fieldKey === CHARACTER_EDIT_FIELD_KEYS.ALTERNATE_GREETINGS,
  );
  const reportAssistantError = (error: unknown) =>
    toastError('Assistant proposal was not updated', error instanceof Error ? error.message : 'The action failed.');

  return (
    <div className="space-y-4">
      {CORE_FIELD_CONFIGS.filter((config) => DIALOGUE_FIELD_ENUM.is(config.key)).map((config) => (
        <CharacterFieldPanel key={config.key} config={config} />
      ))}

      <div className={FIELD_PANEL_CLASS_NAME}>
        {assistantPatchView?.patch.kind === CHARACTER_EDIT_PATCH_KINDS_CASES.STRING_LIST ? (
          <div className="mb-4">
            <CharacterAssistantStructuredReview
              patch={assistantPatchView.patch}
              onApply={() => {
                void workspace
                  .applyProposalFields(assistantPatchView.proposalId, [CHARACTER_EDIT_FIELD_KEYS.ALTERNATE_GREETINGS])
                  .catch(reportAssistantError);
              }}
              onReject={() => {
                void workspace
                  .rejectProposalFields(assistantPatchView.proposalId, [CHARACTER_EDIT_FIELD_KEYS.ALTERNATE_GREETINGS])
                  .catch(reportAssistantError);
              }}
            />
          </div>
        ) : null}
        <AlternateGreetings
          greetings={data.alternate_greetings}
          generationStates={greetingGenerationStates}
          templateOptions={getTemplatesForField(TEMPLATE_FIELD_KEYS.ALTERNATE_GREETING)}
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
            void generateAlternateGreeting(index, GENERATION_MODES.CONTINUE);
          }}
          onRewrite={(index) => {
            void generateAlternateGreeting(index, GENERATION_MODES.REWRITE);
          }}
          onRevertRewrite={revertAlternateGreetingRewrite}
          onAcceptRewrite={acceptAlternateGreetingRewrite}
          onResolveRewriteReview={resolveAlternateGreetingRewriteReview}
          onCancel={cancelAlternateGreetingGeneration}
        />
      </div>
    </div>
  );
}
