import type { CharacterTextFieldKey } from '../card-schema';
import { GENERATION_MODES, GENERATION_TARGET_KINDS } from './generation-contracts';
import type { GenerationMode, iFieldGenerationTarget } from './generation-contracts';
import type { iSeededRandom } from './seeded-random';

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
  'creator',
  'character_version',
  'creator_notes',
  'system_prompt',
  'post_history_instructions',
];

function isVariationEligible(target: iFieldGenerationTarget, mode: GenerationMode) {
  if (mode === GENERATION_MODES.continue) {
    return false;
  }

  if (target.kind !== GENERATION_TARGET_KINDS.field) {
    return true;
  }

  const fieldKey = target.key.replace(/^field:/, '') as CharacterTextFieldKey;
  return !META_FIELD_KEYS.includes(fieldKey);
}

export interface iBuildVariationSectionOptions {
  random: iSeededRandom;
  seed: number;
  target: iFieldGenerationTarget;
  mode: GenerationMode;
}

/**
 * Produces a per-generation variation directive so identical requests still
 * diverge, while staying fully reproducible for a given seed.
 */
export function buildVariationSection({ random, seed, target, mode }: iBuildVariationSectionOptions) {
  if (!isVariationEligible(target, mode)) {
    return '';
  }

  const directive = random.pickFrom(VARIATION_DIRECTIVES);

  if (!directive) {
    return '';
  }

  return [`Variation seed: ${seed}.`, `Creative direction for this generation: ${directive}`].join('\n');
}
