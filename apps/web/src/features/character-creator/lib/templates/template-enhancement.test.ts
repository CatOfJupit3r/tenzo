import { describe, expect, it } from 'vitest';

import { TEMPLATE_MODES } from '../cards/field-templates';
import type { iFieldTemplateViewModel } from '../cards/field-templates';
import { buildTemplateEnhancementMessages, normalizeTemplateEnhancementResponse } from './template-enhancement';

function createTemplate(overrides: Partial<iFieldTemplateViewModel> = {}): iFieldTemplateViewModel {
  return {
    id: 'target-template',
    name: 'Character description',
    description: 'A structured description.',
    mode: TEMPLATE_MODES.prompt,
    fieldKeys: ['description'],
    content: 'Write a vivid description.',
    createdAt: '2026-08-16T00:00:00.000Z',
    updatedAt: '2026-08-16T00:00:00.000Z',
    isBuiltIn: false,
    ...overrides,
  };
}

describe('buildTemplateEnhancementMessages', () => {
  it('separates the target, selected templates, examples, and user guidance', () => {
    const messages = buildTemplateEnhancementMessages({
      targetTemplate: createTemplate(),
      shouldIncludeCurrentTemplate: true,
      referenceTemplates: [
        createTemplate({ id: 'voice-template', name: 'Voice reference', content: 'Use sensory contrasts.' }),
      ],
      exampleCharacters: [{ name: 'Reference Character', personality: 'Guarded and precise.' }],
      guidance: 'Make the sections easier to scan.',
    });

    expect(messages).toHaveLength(2);
    expect(messages[0]?.content).toContain('non-copyable inspiration');
    expect(messages[1]?.content).toContain('Template to enhance:');
    expect(messages[1]?.content).toContain('Write a vivid description.');
    expect(messages[1]?.content).toContain('Other reusable templates:');
    expect(messages[1]?.content).toContain('Use sensory contrasts.');
    expect(messages[1]?.content).toContain('Reference Character');
    expect(messages[1]?.content).toContain('Make the sections easier to scan.');
  });

  it('requires strict output to keep generation slots instead of filling them', () => {
    const messages = buildTemplateEnhancementMessages({
      targetTemplate: createTemplate({
        mode: TEMPLATE_MODES.strict,
        content: '## Appearance\n{{gen:appearance:two vivid paragraphs}}',
      }),
      shouldIncludeCurrentTemplate: true,
      referenceTemplates: [],
      exampleCharacters: [],
      guidance: '',
    });

    expect(messages[0]?.content).toContain('{{gen:label}}');
    expect(messages[0]?.content).toContain('Do not replace slots with generated character content.');
    expect(messages[1]?.content).toContain('{{gen:appearance:two vivid paragraphs}}');
  });

  it('omits the current template content when it is not included', () => {
    const messages = buildTemplateEnhancementMessages({
      targetTemplate: createTemplate(),
      shouldIncludeCurrentTemplate: false,
      referenceTemplates: [],
      exampleCharacters: [],
      guidance: 'Create a fresh structure.',
    });

    expect(messages[1]?.content).toContain('Name: Character description');
    expect(messages[1]?.content).not.toContain('Write a vivid description.');
    expect(messages[1]?.content).not.toContain('Content:');
  });
});

describe('normalizeTemplateEnhancementResponse', () => {
  it('removes a wrapping Markdown fence', () => {
    expect(normalizeTemplateEnhancementResponse('```markdown\n## Description\n{{gen:details}}\n```')).toBe(
      '## Description\n{{gen:details}}',
    );
  });
});
