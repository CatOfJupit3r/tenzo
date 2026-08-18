import { describe, expect, it } from 'vitest';

import { CHARACTER_DATA_EXTENSIONS_SCHEMA } from '../cards/card-schema';
import type { CharacterData } from '../cards/card-schema';
import { computeCharacterTokenStats, guesstimateTokenCount } from './token-stats';

function buildCharacterData(overrides: Partial<CharacterData>): CharacterData {
  return {
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
    extensions: CHARACTER_DATA_EXTENSIONS_SCHEMA.parse({}),
    ...overrides,
  };
}

describe('guesstimateTokenCount', () => {
  it('returns zero for empty text', () => {
    expect(guesstimateTokenCount('')).toBe(0);
  });

  it('scales with byte length', () => {
    const short = guesstimateTokenCount('hello');
    const long = guesstimateTokenCount('hello world, this is a much longer sentence');
    expect(long).toBeGreaterThan(short);
  });
});

describe('computeCharacterTokenStats', () => {
  const tokenCategoryCases = [
    {
      name: 'permanent character fields',
      overrides: {
        name: 'Aria',
        description: 'A brave knight.',
        personality: 'Bold and loyal.',
        scenario: 'A castle under siege.',
      },
      isPermanent: true,
      isTemporary: false,
    },
    {
      name: 'temporary prompt fields',
      overrides: {
        first_mes: 'Hello there!',
        mes_example: '<START>\n{{char}}: Hi.',
        system_prompt: 'Stay in character.',
        post_history_instructions: 'Never break character.',
      },
      isPermanent: false,
      isTemporary: true,
    },
    {
      name: 'excluded metadata fields',
      overrides: {
        creator_notes: 'Some very long creator notes that should not affect the token count at all.',
        creator: 'Someone',
        character_version: '1.0',
      },
      isPermanent: false,
      isTemporary: false,
    },
  ] as const;

  it.each(tokenCategoryCases)(
    'classifies $name according to the business category',
    ({ overrides, isPermanent, isTemporary }) => {
      const stats = computeCharacterTokenStats(buildCharacterData(overrides));

      expect(stats.permanentTokens > 0).toBe(isPermanent);
      expect(stats.temporaryTokens > 0).toBe(isTemporary);
    },
  );

  it('sums permanent and temporary into total', () => {
    const data = buildCharacterData({
      name: 'Aria',
      first_mes: 'Hello there!',
    });
    const stats = computeCharacterTokenStats(data);
    expect(stats.totalTokens).toBe(stats.permanentTokens + stats.temporaryTokens);
  });
});
