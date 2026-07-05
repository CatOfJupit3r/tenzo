import { describe, expect, it } from 'vitest';

import { MACRO_KINDS, findMacroRanges } from './macro-tokens';

describe('findMacroRanges', () => {
  it('finds char and user macros with correct ranges', () => {
    const text = '{{char}} greets {{user}}.';
    const ranges = findMacroRanges(text, { doesAllowOriginalMacro: false });
    expect(ranges).toEqual([
      { from: 0, to: 8, kind: MACRO_KINDS.char },
      { from: 16, to: 24, kind: MACRO_KINDS.user },
    ]);
  });

  it('handles whitespace inside braces', () => {
    const ranges = findMacroRanges('{{ char }} and {{  user  }}', { doesAllowOriginalMacro: false });
    expect(ranges.map((range) => range.kind)).toEqual([MACRO_KINDS.char, MACRO_KINDS.user]);
  });

  it('is case-insensitive for macro names', () => {
    const ranges = findMacroRanges('{{Char}} {{USER}}', { doesAllowOriginalMacro: false });
    expect(ranges.map((range) => range.kind)).toEqual([MACRO_KINDS.char, MACRO_KINDS.user]);
  });

  it('treats original as known only when allowed', () => {
    const text = 'before {{original}} after';
    expect(findMacroRanges(text, { doesAllowOriginalMacro: true })[0]?.kind).toBe(MACRO_KINDS.original);
    expect(findMacroRanges(text, { doesAllowOriginalMacro: false })[0]?.kind).toBe(MACRO_KINDS.unknown);
  });

  it('marks unrecognized macros as unknown', () => {
    const ranges = findMacroRanges('{{random_macro}}', { doesAllowOriginalMacro: false });
    expect(ranges).toEqual([{ from: 0, to: 16, kind: MACRO_KINDS.unknown }]);
  });

  it('ignores single braces and unclosed macros', () => {
    expect(findMacroRanges('{char} {{user', { doesAllowOriginalMacro: false })).toEqual([]);
  });

  it('returns no ranges for plain text', () => {
    expect(findMacroRanges('no macros here', { doesAllowOriginalMacro: false })).toEqual([]);
  });
});
