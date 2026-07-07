import { FIELD_EDITOR_VARIANTS, METADATA_FIELD_CONFIGS } from '../../constants/field-config';
import { useCharacterCreatorContext } from '../../context/character-creator-context/character-creator-context.hooks';
import { TEMPLATE_FIELD_KEYS } from '../../lib/field-templates';
import { GENERATION_MODES } from '../../lib/prompt/generation-contracts';
import { CharacterField } from '../character-field';
import { CharacterFieldPanel } from '../character-field-panel';
import { CustomFields } from '../custom-fields';
import { TagsInput } from '../tags-input';
import { FIELD_PANEL_CLASS_NAME } from './tabs.constants';

export function MetadataTab() {
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

      <TagsInput value={data.tags} onChange={updateTags} />

      <div className="grid gap-4 xl:grid-cols-2">
        {METADATA_FIELD_CONFIGS.map((config) => (
          <CharacterFieldPanel key={config.key} config={config} isWide={config.key === 'creator_notes'} />
        ))}
      </div>

      <div className={FIELD_PANEL_CLASS_NAME}>
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
        />
      </div>
    </div>
  );
}
