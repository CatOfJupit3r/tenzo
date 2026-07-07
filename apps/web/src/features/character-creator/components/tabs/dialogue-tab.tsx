import { CORE_FIELD_CONFIGS } from '../../constants/field-config';
import { useCharacterCreatorContext } from '../../context/character-creator-context/character-creator-context.hooks';
import { TEMPLATE_FIELD_KEYS } from '../../lib/field-templates';
import { GENERATION_MODES } from '../../lib/prompt/generation-contracts';
import { AlternateGreetings } from '../alternate-greetings';
import { CharacterFieldPanel } from '../character-field-panel';
import { FIELD_PANEL_CLASS_NAME } from './tabs.constants';

const DIALOGUE_FIELD_KEYS = new Set(['first_mes', 'mes_example']);

export function DialogueTab() {
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

  return (
    <div className="space-y-4">
      {CORE_FIELD_CONFIGS.filter((config) => DIALOGUE_FIELD_KEYS.has(config.key)).map((config) => (
        <CharacterFieldPanel key={config.key} config={config} />
      ))}

      <div className={FIELD_PANEL_CLASS_NAME}>
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
        />
      </div>
    </div>
  );
}
