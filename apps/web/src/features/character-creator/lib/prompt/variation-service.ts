import {
  CHARACTER_TEXT_FIELD_KEY,
  CHARACTER_TEXT_FIELD_KEY_ENUM,
} from '@~/features/character-creator/lib/cards/card-schema';

import type { CharacterTextFieldKey } from '../cards/card-schema';
import type { GenerationMode, iFieldGenerationTarget } from './generation-contracts';
import { GENERATION_MODES, GENERATION_TARGET_KINDS } from './generation-contracts';
import type { SeededRandom } from './seeded-random';

export const VARIATION_DIRECTIVES: readonly string[] = [
  'Lean into one unexpected contradiction in the character.',
  'Favor concrete, sensory details over abstract descriptions.',
  'Let a small flaw or vulnerability quietly show through.',
  'Anchor the writing around one vivid, specific image.',
  'Give the character one habit or mannerism that reveals their history.',
  'Use a slightly unusual rhythm or cadence in the wording.',
  'Hint at something the character wants but never says outright.',
  'Ground the character in a mundane detail of daily life.',
  'Introduce one element of tension or unease beneath the surface.',
  'Let warmth or humor surface in an understated way.',
  'Emphasize what the character notices that others overlook.',
  'Choose one less obvious angle instead of the most expected one.',
];

const META_FIELD_KEYS: CharacterTextFieldKey[] = [
  CHARACTER_TEXT_FIELD_KEY.CREATOR,
  CHARACTER_TEXT_FIELD_KEY.CHARACTER_VERSION,
  CHARACTER_TEXT_FIELD_KEY.CREATOR_NOTES,
  CHARACTER_TEXT_FIELD_KEY.SYSTEM_PROMPT,
  CHARACTER_TEXT_FIELD_KEY.POST_HISTORY_INSTRUCTIONS,
];

export interface iBuildVariationSectionOptions {
  random: SeededRandom;
  seed: number;
  target: iFieldGenerationTarget;
  mode: GenerationMode;
}

/**
 * Produces a per-generation variation directive so identical requests still
 * diverge, while staying fully reproducible for a given seed.
 */
export class VariationService {
  constructor(private readonly directives: readonly string[] = VARIATION_DIRECTIVES) {}

  buildSection({ random, seed, target, mode }: iBuildVariationSectionOptions): string {
    if (!this.isEligible(target, mode)) {
      return '';
    }

    const directive = random.pickFrom(this.directives);

    if (!directive) {
      return '';
    }

    return [`Variation seed: ${seed}.`, `Creative direction for this generation: ${directive}`].join('\n');
  }

  private isEligible(target: iFieldGenerationTarget, mode: GenerationMode) {
    if (mode === GENERATION_MODES.CONTINUE) {
      return false;
    }

    if (target.kind === GENERATION_TARGET_KINDS.GENERAL_CHARACTER_IDEA) {
      return false;
    }

    if (target.kind !== GENERATION_TARGET_KINDS.FIELD) {
      return true;
    }

    const fieldKey = CHARACTER_TEXT_FIELD_KEY_ENUM.parse(target.key.replace(/^field:/, ''));
    return !META_FIELD_KEYS.includes(fieldKey);
  }
}
