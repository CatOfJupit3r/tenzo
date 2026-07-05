import { describe, expect, it } from 'vitest';

import { CHARACTER_DATA_EXTENSIONS_SCHEMA } from './card-schema';
import type { CharacterData } from './card-schema';
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
  it('counts name/description/personality/scenario as permanent', () => {
    const data = buildCharacterData({
      name: 'Aria',
      description: 'A brave knight.',
      personality: 'Bold and loyal.',
      scenario: 'A castle under siege.',
    });
    const stats = computeCharacterTokenStats(data);
    expect(stats.permanentTokens).toBeGreaterThan(0);
    expect(stats.temporaryTokens).toBe(0);
    expect(stats.totalTokens).toBe(stats.permanentTokens);
  });

  it('counts first_mes/mes_example/system_prompt/post_history_instructions as temporary', () => {
    const data = buildCharacterData({
      first_mes: 'Hello there!',
      mes_example: '<START>\n{{char}}: Hi.',
      system_prompt: 'Stay in character.',
      post_history_instructions: 'Never break character.',
    });
    const stats = computeCharacterTokenStats(data);
    expect(stats.permanentTokens).toBe(0);
    expect(stats.temporaryTokens).toBeGreaterThan(0);
    expect(stats.totalTokens).toBe(stats.temporaryTokens);
  });

  it('does not count creator notes, creator, or version fields', () => {
    const data = buildCharacterData({
      creator_notes: 'Some very long creator notes that should not affect the token count at all.',
      creator: 'Someone',
      character_version: '1.0',
    });
    expect(computeCharacterTokenStats(data).totalTokens).toBe(0);
  });

  it('sums permanent and temporary into total', () => {
    const data = buildCharacterData({
      name: 'Aria',
      first_mes: 'Hello there!',
    });
    const stats = computeCharacterTokenStats(data);
    expect(stats.totalTokens).toBe(stats.permanentTokens + stats.temporaryTokens);
  });
});
