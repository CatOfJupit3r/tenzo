import { CORE_FIELD_CONFIGS } from '../../constants/field-config';
import { CharacterFieldPanel } from '../character-field-panel';

const DIALOGUE_FIELD_KEYS = new Set(['first_mes', 'mes_example']);

export function CoreFieldsTab() {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {CORE_FIELD_CONFIGS.filter((config) => !DIALOGUE_FIELD_KEYS.has(config.key)).map((config) => (
        <CharacterFieldPanel key={config.key} config={config} isWide={config.key === 'description'} />
      ))}
    </div>
  );
}
