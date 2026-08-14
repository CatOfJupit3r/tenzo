import { describe, expect, it } from 'vitest';

import { parseSlotResponse, renderStrictTemplate } from './strict-template-renderer';

describe('parseSlotResponse', () => {
  it('parses closed slot tags', () => {
    const slotValues = parseSlotResponse(
      '<slot name="appearance">Tall and windburned.</slot>\n<slot name="background">Raised by cartographers.</slot>',
    );

    expect(slotValues).toEqual({
      appearance: 'Tall and windburned.',
      background: 'Raised by cartographers.',
    });
  });

  it('includes a trailing unclosed slot with its partial value', () => {
    const slotValues = parseSlotResponse(
      '<slot name="appearance">Tall and windburned.</slot><slot name="background">Raised by',
    );

    expect(slotValues).toEqual({
      appearance: 'Tall and windburned.',
      background: 'Raised by',
    });
  });

  it('drops a trailing partial closing tag from a streamed value', () => {
    const slotValues = parseSlotResponse('<slot name="speech">Clipped, precise.</slo');

    expect(slotValues).toEqual({ speech: 'Clipped, precise.' });
  });

  it('normalizes slot names and unwraps code fences', () => {
    const slotValues = parseSlotResponse('```xml\n<slot name="Eye Color">Amber</slot>\n```');

    expect(slotValues).toEqual({ 'eye color': 'Amber' });
  });
});

describe('renderStrictTemplate', () => {
  const template =
    '**Appearance:** {{gen:appearance:build}}\n**Speech:** {{gen:speech}}\nSays hi to {{user}} as {{char}}.';

  it('substitutes values and preserves macros verbatim', () => {
    const rendered = renderStrictTemplate(template, { appearance: 'Tall.', speech: 'Soft-spoken.' });

    expect(rendered).toBe('**Appearance:** Tall.\n**Speech:** Soft-spoken.\nSays hi to {{user}} as {{char}}.');
  });

  it('keeps unresolved slot tokens visible', () => {
    const rendered = renderStrictTemplate(template, { appearance: 'Tall.' });

    expect(rendered).toContain('**Appearance:** Tall.');
    expect(rendered).toContain('{{gen:speech}}');
  });

  it('fills repeated slot labels everywhere they appear', () => {
    const rendered = renderStrictTemplate('{{gen:name}} — again: {{gen:Name:hint}}', { name: 'Ash' });

    expect(rendered).toBe('Ash — again: Ash');
  });
});
