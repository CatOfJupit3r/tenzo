import { PROMPT_OVERRIDE_FIELD_CONFIGS } from '../../constants/field-config';
import { CharacterFieldPanel } from '../character-field-panel';

export function PromptOverridesTab() {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {PROMPT_OVERRIDE_FIELD_CONFIGS.map((config) => (
        <CharacterFieldPanel key={config.key} config={config} />
      ))}
    </div>
  );
}
