import { CHARACTER_TEXT_FIELD_KEY } from '@~/features/character-creator/lib/cards/card-schema';

import { CORE_FIELD_CONFIGS } from '../../constants/field-config';
import { CharacterFieldPanel } from '../character-field-panel';
import { DIALOGUE_FIELD_ENUM } from './tabs.constants';

export function CoreFieldsTab() {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {CORE_FIELD_CONFIGS.filter((config) => !DIALOGUE_FIELD_ENUM.is(config.key)).map((config) => (
        <CharacterFieldPanel
          key={config.key}
          config={config}
          isWide={config.key === CHARACTER_TEXT_FIELD_KEY.DESCRIPTION}
        />
      ))}
    </div>
  );
}
