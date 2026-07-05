import { describe, expect, it } from 'vitest';

import { MES_EXAMPLE_LINE_KINDS, classifyMesExampleLine, getSpeakerPrefixLength } from './mes-example-format';

describe('classifyMesExampleLine', () => {
  it('classifies START separators case-insensitively', () => {
    expect(classifyMesExampleLine('<START>')).toBe(MES_EXAMPLE_LINE_KINDS.start);
    expect(classifyMesExampleLine('<start>')).toBe(MES_EXAMPLE_LINE_KINDS.start);
    expect(classifyMesExampleLine('  <START>  ')).toBe(MES_EXAMPLE_LINE_KINDS.start);
  });

  it('classifies speaker turns', () => {
    expect(classifyMesExampleLine('{{char}}: Hello there.')).toBe(MES_EXAMPLE_LINE_KINDS.charTurn);
    expect(classifyMesExampleLine('{{user}}: Hi!')).toBe(MES_EXAMPLE_LINE_KINDS.userTurn);
    expect(classifyMesExampleLine('{{CHAR}}: shouting')).toBe(MES_EXAMPLE_LINE_KINDS.charTurn);
  });

  it('classifies everything else as plain', () => {
    expect(classifyMesExampleLine('')).toBe(MES_EXAMPLE_LINE_KINDS.plain);
    expect(classifyMesExampleLine('narrative continues here')).toBe(MES_EXAMPLE_LINE_KINDS.plain);
    expect(classifyMesExampleLine('<START> of something')).toBe(MES_EXAMPLE_LINE_KINDS.plain);
    expect(classifyMesExampleLine('{{other}}: nope')).toBe(MES_EXAMPLE_LINE_KINDS.plain);
  });
});

describe('getSpeakerPrefixLength', () => {
  it('measures the speaker prefix including the colon', () => {
    expect(getSpeakerPrefixLength('{{char}}: Hello')).toBe('{{char}}:'.length);
    expect(getSpeakerPrefixLength('  {{user}}: Hi')).toBe('  {{user}}:'.length);
  });

  it('returns zero for lines without a speaker prefix', () => {
    expect(getSpeakerPrefixLength('plain line')).toBe(0);
    expect(getSpeakerPrefixLength('<START>')).toBe(0);
  });
});
