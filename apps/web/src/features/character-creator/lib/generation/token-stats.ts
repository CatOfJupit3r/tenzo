import { CHARACTER_TEXT_FIELD_KEY } from '@~/features/character-creator/lib/cards/card-schema';

import type { CharacterData, CharacterTextFieldKey } from '../cards/card-schema';

/**
 * SillyTavern's own fallback ratio for estimating tokens when no real tokenizer is
 * available (see `guesstimate()` in SillyTavern's tokenizers.js). We have no tokenizer
 * in the browser bundle, so we use the same approximation for parity with its numbers.
 */
const CHARACTERS_PER_TOKEN_RATIO = 3.35;

const textEncoder = new TextEncoder();

export function guesstimateTokenCount(text: string): number {
  if (!text) {
    return 0;
  }
  const byteLength = textEncoder.encode(text).length;
  return Math.ceil(byteLength / CHARACTERS_PER_TOKEN_RATIO);
}

/**
 * Fields SillyTavern's character editor marks `data-token-permanent="true"`: they're part
 * of the character definition injected into every prompt, as opposed to fields like the
 * first message or example dialogue that are only used situationally.
 */
export const PERMANENT_TOKEN_FIELD_KEYS: CharacterTextFieldKey[] = [
  CHARACTER_TEXT_FIELD_KEY.NAME,
  CHARACTER_TEXT_FIELD_KEY.DESCRIPTION,
  CHARACTER_TEXT_FIELD_KEY.PERSONALITY,
  CHARACTER_TEXT_FIELD_KEY.SCENARIO,
];

export const TEMPORARY_TOKEN_FIELD_KEYS: CharacterTextFieldKey[] = [
  CHARACTER_TEXT_FIELD_KEY.FIRST_MES,
  CHARACTER_TEXT_FIELD_KEY.MES_EXAMPLE,
  CHARACTER_TEXT_FIELD_KEY.SYSTEM_PROMPT,
  CHARACTER_TEXT_FIELD_KEY.POST_HISTORY_INSTRUCTIONS,
];

export interface iCharacterTokenStats {
  permanentTokens: number;
  temporaryTokens: number;
  totalTokens: number;
}

function sumFieldTokens(data: CharacterData, keys: CharacterTextFieldKey[]): number {
  return keys.reduce((sum, key) => sum + guesstimateTokenCount(data[key]), 0);
}

export function computeCharacterTokenStats(data: CharacterData): iCharacterTokenStats {
  const permanentTokens = sumFieldTokens(data, PERMANENT_TOKEN_FIELD_KEYS);
  const temporaryTokens = sumFieldTokens(data, TEMPORARY_TOKEN_FIELD_KEYS);
  return {
    permanentTokens,
    temporaryTokens,
    totalTokens: permanentTokens + temporaryTokens,
  };
}
