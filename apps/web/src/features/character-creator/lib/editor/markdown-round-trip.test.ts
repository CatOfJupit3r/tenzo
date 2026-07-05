import { Editor } from '@tiptap/core';
import { describe, expect, it } from 'vitest';

import { buildMarkdownEditorExtensions, serializeEditorMarkdown } from './markdown-editor-extensions';

function roundTrip(markdown: string): string {
  const editor = new Editor({
    extensions: buildMarkdownEditorExtensions(),
    content: markdown,
    contentType: 'markdown',
  });
  const output = serializeEditorMarkdown(editor);
  editor.destroy();
  return output;
}

describe('markdown round trip', () => {
  it('preserves plain multi-line text', () => {
    expect(roundTrip('first line\nsecond line')).toBe('first line\nsecond line');
  });

  it('preserves paragraphs separated by blank lines', () => {
    expect(roundTrip('first paragraph\n\nsecond paragraph')).toBe('first paragraph\n\nsecond paragraph');
  });

  it('preserves inline formatting', () => {
    expect(roundTrip('**bold** *italic* ~~strike~~ `code`')).toBe('**bold** *italic* ~~strike~~ `code`');
  });

  it('preserves headings', () => {
    expect(roundTrip('# Title\n\n## Subtitle\n\n### Section')).toBe('# Title\n\n## Subtitle\n\n### Section');
  });

  it('preserves bullet lists', () => {
    expect(roundTrip('- one\n- two\n- three')).toBe('- one\n- two\n- three');
  });

  it('preserves ordered lists', () => {
    expect(roundTrip('1. one\n2. two')).toBe('1. one\n2. two');
  });

  it('preserves blockquotes', () => {
    expect(roundTrip('> quoted text')).toBe('> quoted text');
  });

  it('preserves code fences', () => {
    expect(roundTrip('```\nconst value = 1;\n```')).toBe('```\nconst value = 1;\n```');
  });

  it('does not escape character macros', () => {
    expect(roundTrip('{{char}} greets {{user}} warmly.')).toBe('{{char}} greets {{user}} warmly.');
  });

  it('does not escape macros with spacing variants', () => {
    expect(roundTrip('{{ char }} meets {{ user }}')).toBe('{{ char }} meets {{ user }}');
  });

  it('does not escape underscores in plain prose', () => {
    expect(roundTrip('uses snake_case identifiers')).toBe('uses snake_case identifiers');
  });

  it('preserves asterisk roleplay actions as italics', () => {
    expect(roundTrip('*smiles softly* Hello there.')).toBe('*smiles softly* Hello there.');
  });

  it('is stable across repeated round trips for underscored text', () => {
    const once = roundTrip('uses snake_case identifiers');
    expect(roundTrip(once)).toBe(once);
  });

  it('preserves a typical character description', () => {
    const description = [
      '# Aria',
      '',
      '**Appearance:** silver hair, storm-gray eyes.',
      '',
      '- calm under pressure',
      '- fiercely loyal to {{user}}',
      '',
      '> "I never break a promise."',
    ].join('\n');
    expect(roundTrip(description)).toBe(description);
  });
});
