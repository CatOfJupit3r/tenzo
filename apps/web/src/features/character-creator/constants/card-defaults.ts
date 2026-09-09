import {
  CHARACTER_CARD_SPECS,
  CHARACTER_CARD_SPEC_VERSIONS,
} from '@~/features/character-creator/lib/cards/card-file-enums';

import type { CharacterCard } from '../lib/cards/card-schema';

export const createEmptyCharacterCard = (): CharacterCard => ({
  spec: CHARACTER_CARD_SPECS.CHARA_CARD_V2,
  spec_version: CHARACTER_CARD_SPEC_VERSIONS.VALUE_2_0,
  data: {
    name: '',
    description: '',
    personality: '',
    scenario: '',
    first_mes: '',
    mes_example: '',
    creator_notes: '',
    system_prompt: '',
    post_history_instructions: '',
    alternate_greetings: [],
    tags: [],
    creator: '',
    character_version: '',
    extensions: { custom_fields: [] },
  },
});
