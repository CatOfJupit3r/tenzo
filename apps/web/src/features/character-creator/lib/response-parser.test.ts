import { describe, expect, it } from 'vitest';

import { OUTPUT_FORMATS } from './generation-config';
import { getPrefilled, parseResponse } from './response-parser';

describe('response-parser', () => {
  it('extracts xml wrapped content', () => {
    const parsed = parseResponse('<response>Hello {{char}}</response>', OUTPUT_FORMATS.xml);

    expect(parsed).toBe('Hello {{char}}');
  });

  it('extracts json wrapped content from code fences', () => {
    const parsed = parseResponse('```json\n{\n  "response": "Line one\\nLine two"\n}\n```', OUTPUT_FORMATS.json);

    expect(parsed).toBe('Line one\nLine two');
  });

  it('falls back gracefully for partial xml continue content', () => {
    const parsed = parseResponse('<response>Partial answer still streaming', OUTPUT_FORMATS.xml);

    expect(parsed).toBe('Partial answer still streaming');
  });

  it('builds continue prefills for each output format', () => {
    expect(getPrefilled('Alpha', OUTPUT_FORMATS.xml)).toBe('<response>Alpha');
    expect(getPrefilled('Alpha', OUTPUT_FORMATS.json)).toBe('{"response":"Alpha');
    expect(getPrefilled('Alpha', OUTPUT_FORMATS.none)).toBe('Alpha');
  });
});
