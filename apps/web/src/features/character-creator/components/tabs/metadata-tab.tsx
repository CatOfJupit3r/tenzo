import { toastError } from '@~/components/toastifications/create-jsx-toasts';

import { FIELD_EDITOR_VARIANTS, METADATA_FIELD_CONFIGS } from '../../constants/field-config';
import { useCharacterAssistant } from '../../context/character-assistant-context.hooks';
import { useCharacterCreatorContext } from '../../context/character-creator-context/character-creator-context.hooks';
import { CHARACTER_EDIT_FIELD_KEYS } from '../../lib/character-edit-proposal';
import { TEMPLATE_FIELD_KEYS } from '../../lib/field-templates';
import { GENERATION_MODES } from '../../lib/prompt/generation-contracts';
import { CharacterAssistantStructuredReview } from '../character-assistant-structured-review';
import { CharacterField } from '../character-field';
import { CharacterFieldPanel } from '../character-field-panel';
import { CustomFields } from '../custom-fields';
import { TagsInput } from '../tags-input';
import { FIELD_PANEL_CLASS_NAME } from './tabs.constants';

export function MetadataTab() {
  const { openAssistantForField, workspace } = useCharacterAssistant();
  const {
    data,
    updateTags,
    generalCharacterIdea,
    updateGeneralCharacterIdea,
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
    (patchView) => patchView.patch.fieldKey === CHARACTER_EDIT_FIELD_KEYS.tags,
  );
  const customFieldsPatchView = workspace.activePatches.find(
    (patchView) => patchView.patch.fieldKey === CHARACTER_EDIT_FIELD_KEYS.custom_fields,
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
          editorVariant={FIELD_EDITOR_VARIANTS.markdown}
          hint="Shared concept, tone, or high-level direction available to every field generation."
          onValueChange={updateGeneralCharacterIdea}
        />
      </div>

      <div className={FIELD_PANEL_CLASS_NAME}>
        {tagsPatchView?.patch.kind === 'string-list' ? (
          <div className="mb-4">
            <CharacterAssistantStructuredReview
              patch={tagsPatchView.patch}
              onApply={() => {
                void workspace
                  .applyProposalFields(tagsPatchView.proposalId, [CHARACTER_EDIT_FIELD_KEYS.tags])
                  .catch(reportAssistantError);
              }}
              onReject={() => {
                void workspace
                  .rejectProposalFields(tagsPatchView.proposalId, [CHARACTER_EDIT_FIELD_KEYS.tags])
                  .catch(reportAssistantError);
              }}
            />
          </div>
        ) : null}
        <TagsInput
          value={data.tags}
          onChange={updateTags}
          onAskAssistant={() => openAssistantForField(CHARACTER_EDIT_FIELD_KEYS.tags)}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {METADATA_FIELD_CONFIGS.map((config) => (
          <CharacterFieldPanel key={config.key} config={config} isWide={config.key === 'creator_notes'} />
        ))}
      </div>

      <div className={FIELD_PANEL_CLASS_NAME}>
        {customFieldsPatchView?.patch.kind === 'custom-fields' ? (
          <div className="mb-4">
            <CharacterAssistantStructuredReview
              patch={customFieldsPatchView.patch}
              onApply={() => {
                void workspace
                  .applyProposalFields(customFieldsPatchView.proposalId, [CHARACTER_EDIT_FIELD_KEYS.custom_fields])
                  .catch(reportAssistantError);
              }}
              onReject={() => {
                void workspace
                  .rejectProposalFields(customFieldsPatchView.proposalId, [CHARACTER_EDIT_FIELD_KEYS.custom_fields])
                  .catch(reportAssistantError);
              }}
            />
          </div>
        ) : null}
        <CustomFields
          fields={data.extensions.custom_fields}
          generationStates={customFieldGenerationStates}
          templateOptions={getTemplatesForField(TEMPLATE_FIELD_KEYS.custom_field)}
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
            void generateCustomField(id, GENERATION_MODES.continue);
          }}
          onRewrite={(id) => {
            void generateCustomField(id, GENERATION_MODES.rewrite);
          }}
          onRevertRewrite={revertCustomFieldRewrite}
          onAcceptRewrite={acceptCustomFieldRewrite}
          onResolveRewriteReview={resolveCustomFieldRewriteReview}
          onCancel={cancelCustomFieldGeneration}
          onAskAssistant={() => openAssistantForField(CHARACTER_EDIT_FIELD_KEYS.custom_fields)}
        />
      </div>
    </div>
  );
}
