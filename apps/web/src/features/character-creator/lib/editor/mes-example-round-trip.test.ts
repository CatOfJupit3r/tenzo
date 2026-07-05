import { Editor } from '@tiptap/core';
import { describe, expect, it } from 'vitest';

import { buildMesExampleExtensions, parseMesExampleToDoc, serializeMesExampleDoc } from './mes-example-extensions';

function roundTrip(raw: string): string {
  const editor = new Editor({
    extensions: buildMesExampleExtensions(),
    content: parseMesExampleToDoc(raw),
  });
  const output = serializeMesExampleDoc(editor.state.doc);
  editor.destroy();
  return output;
}

describe('mes_example round trip', () => {
  it('preserves a typical two-block sample byte-exactly', () => {
    const sample = [
      '<START>',
      '{{user}}: How are you?',
      '{{char}}: *stretches lazily* Never better.',
      '<START>',
      '{{user}}: Tell me a secret.',
      '{{char}}: Only if you keep it.',
    ].join('\n');
    expect(roundTrip(sample)).toBe(sample);
  });

  it('preserves empty input', () => {
    expect(roundTrip('')).toBe('');
  });

  it('preserves a trailing newline', () => {
    expect(roundTrip('<START>\n{{char}}: Hello.\n')).toBe('<START>\n{{char}}: Hello.\n');
  });

  it('preserves blank lines between blocks', () => {
    expect(roundTrip('line one\n\n\nline two')).toBe('line one\n\n\nline two');
  });

  it('preserves trailing spaces on lines', () => {
    expect(roundTrip('{{char}}: pauses...  \nnext line')).toBe('{{char}}: pauses...  \nnext line');
  });

  it('preserves lowercase start markers', () => {
    expect(roundTrip('<start>\n{{user}}: hi')).toBe('<start>\n{{user}}: hi');
  });

  it('does not transform markdown-like syntax', () => {
    const sample = '{{char}}: *grins* **loudly** _quietly_ `code` # not a heading';
    expect(roundTrip(sample)).toBe(sample);
  });
});
