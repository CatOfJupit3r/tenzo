import { toastError } from '@~/components/toastifications/create-jsx-toasts';
import { CHARACTER_TEXT_FIELD_KEY } from '@~/features/character-creator/lib/cards/card-schema';
import {
  CHARACTER_EDIT_FIELD_KEYS,
  CHARACTER_EDIT_PATCH_KINDS_CASES,
} from '@~/features/character-creator/lib/proposals/character-edit-proposal';

import { FIELD_EDITOR_VARIANTS, METADATA_FIELD_CONFIGS } from '../../constants/field-config';
import { useCharacterAssistant } from '../../context/character-assistant-context.hooks';
import { useCharacterCreatorContext } from '../../context/character-creator-context/character-creator-context.hooks';
import { TEMPLATE_FIELD_KEYS } from '../../lib/cards/field-templates';
import { GENERATION_MODES } from '../../lib/prompt/generation-contracts';
import { CharacterAssistantStructuredReview } from '../character-assistant-structured-review';
import { CharacterField } from '../character-field';
import { CharacterFieldPanel } from '../character-field-panel';
import { CustomFields } from '../custom-fields';
import { TagsInput } from '../tags-input';
import { FIELD_PANEL_CLASS_NAME } from './tabs.constants';

export function MetadataTab() {
  const { workspace } = useCharacterAssistant();
  const {
    data,
    updateTags,
    generalCharacterIdea,
    updateGeneralCharacterIdea,
    generalCharacterIdeaGenerationState,
    generateGeneralCharacterIdea,
    cancelGeneralCharacterIdeaGeneration,
    revertGeneralCharacterIdeaRewrite,
    resolveGeneralCharacterIdeaRewriteReview,
    acceptGeneralCharacterIdeaRewrite,
    updateGeneralCharacterIdeaInstruction,
    addCustomField,
    updateCustomField,
    handleRemoveCustomField,
    customFieldGenerationStates,
    updateCustomFieldShouldUseGeneralCharacterIdea,
    updateCustomFieldInstruction,
    updateCustomFieldTemplateId,
    getTemplatesForField,
    addFieldTemplate,
    generateCustomField,
    cancelCustomFieldGeneration,
    revertCustomFieldRewrite,
    resolveCustomFieldRewriteReview,
    acceptCustomFieldRewrite,
  } = useCharacterCreatorContext();
  const tagsPatchView = workspace.activePatches.find(
    (patchView) => patchView.patch.fieldKey === CHARACTER_EDIT_FIELD_KEYS.TAGS,
  );
  const customFieldsPatchView = workspace.activePatches.find(
    (patchView) => patchView.patch.fieldKey === CHARACTER_EDIT_FIELD_KEYS.CUSTOM_FIELDS,
  );
  const reportAssistantError = (error: unknown) =>
    toastError('Assistant proposal was not updated', error instanceof Error ? error.message : 'The action failed.');

  return (
    <div className="space-y-4">
      <div className={FIELD_PANEL_CLASS_NAME}>
        <CharacterField
          fieldId="general-character-idea"
          label="General Character Idea"
          value={generalCharacterIdea}
          rows={4}
          editorVariant={FIELD_EDITOR_VARIANTS.MARKDOWN}
          hint="Shared concept, tone, or high-level direction available to every field generation."
          shouldShowGeneralCharacterIdeaToggle={false}
          instructionValue={generalCharacterIdeaGenerationState.instructionValue}
          generationErrorMessage={generalCharacterIdeaGenerationState.errorMessage}
          isGenerating={generalCharacterIdeaGenerationState.isGenerating}
          hasRewriteBackup={generalCharacterIdeaGenerationState.hasRewriteBackup}
          isRewriteReviewPending={generalCharacterIdeaGenerationState.isRewriteReviewPending}
          rewriteBackupValue={generalCharacterIdeaGenerationState.rewriteBackupValue}
          onValueChange={updateGeneralCharacterIdea}
          onInstructionChange={updateGeneralCharacterIdeaInstruction}
          onGenerate={async () => generateGeneralCharacterIdea(GENERATION_MODES.GENERATE)}
          onContinue={async () => generateGeneralCharacterIdea(GENERATION_MODES.CONTINUE)}
          onRewrite={async () => generateGeneralCharacterIdea(GENERATION_MODES.REWRITE)}
          onRevertRewrite={revertGeneralCharacterIdeaRewrite}
          onAcceptRewrite={acceptGeneralCharacterIdeaRewrite}
          onResolveRewriteReview={resolveGeneralCharacterIdeaRewriteReview}
          onCancel={cancelGeneralCharacterIdeaGeneration}
        />
      </div>

      <div className={FIELD_PANEL_CLASS_NAME}>
        {tagsPatchView?.patch.kind === CHARACTER_EDIT_PATCH_KINDS_CASES.STRING_LIST ? (
          <div className="mb-4">
            <CharacterAssistantStructuredReview
              patch={tagsPatchView.patch}
              onApply={() => {
                void workspace
                  .applyProposalFields(tagsPatchView.proposalId, [CHARACTER_EDIT_FIELD_KEYS.TAGS])
                  .catch(reportAssistantError);
              }}
              onReject={() => {
                void workspace
                  .rejectProposalFields(tagsPatchView.proposalId, [CHARACTER_EDIT_FIELD_KEYS.TAGS])
                  .catch(reportAssistantError);
              }}
            />
          </div>
        ) : null}
        <TagsInput value={data.tags} onChange={updateTags} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {METADATA_FIELD_CONFIGS.map((config) => (
          <CharacterFieldPanel
            key={config.key}
            config={config}
            isWide={config.key === CHARACTER_TEXT_FIELD_KEY.CREATOR_NOTES}
          />
        ))}
      </div>

      <div className={FIELD_PANEL_CLASS_NAME}>
        {customFieldsPatchView?.patch.kind === CHARACTER_EDIT_PATCH_KINDS_CASES.CUSTOM_FIELDS ? (
          <div className="mb-4">
            <CharacterAssistantStructuredReview
              patch={customFieldsPatchView.patch}
              onApply={() => {
                void workspace
                  .applyProposalFields(customFieldsPatchView.proposalId, [CHARACTER_EDIT_FIELD_KEYS.CUSTOM_FIELDS])
                  .catch(reportAssistantError);
              }}
              onReject={() => {
                void workspace
                  .rejectProposalFields(customFieldsPatchView.proposalId, [CHARACTER_EDIT_FIELD_KEYS.CUSTOM_FIELDS])
                  .catch(reportAssistantError);
              }}
            />
          </div>
        ) : null}
        <CustomFields
          fields={data.extensions.custom_fields}
          generationStates={customFieldGenerationStates}
          templateOptions={getTemplatesForField(TEMPLATE_FIELD_KEYS.CUSTOM_FIELD)}
          onAdd={addCustomField}
          onUpdate={updateCustomField}
          onRemove={handleRemoveCustomField}
          onTemplateIdChange={updateCustomFieldTemplateId}
          onSaveTemplate={addFieldTemplate}
          onShouldUseGeneralCharacterIdeaChange={updateCustomFieldShouldUseGeneralCharacterIdea}
          onInstructionChange={updateCustomFieldInstruction}
          onGenerate={(id) => {
            void generateCustomField(id);
          }}
          onContinue={(id) => {
            void generateCustomField(id, GENERATION_MODES.CONTINUE);
          }}
          onRewrite={(id) => {
            void generateCustomField(id, GENERATION_MODES.REWRITE);
          }}
          onRevertRewrite={revertCustomFieldRewrite}
          onAcceptRewrite={acceptCustomFieldRewrite}
          onResolveRewriteReview={resolveCustomFieldRewriteReview}
          onCancel={cancelCustomFieldGeneration}
        />
      </div>
    </div>
  );
}
