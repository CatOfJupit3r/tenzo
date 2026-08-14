import { describe, expect, it } from 'vitest';

import {
  getTemplateFieldKeyForTargetKey,
  parseTemplateSlots,
  TEMPLATE_FIELD_KEYS,
  TEMPLATE_MODES,
  validateFieldTemplate,
} from './field-templates';

describe('parseTemplateSlots', () => {
  it('extracts slots in order of first appearance with hints', () => {
    const slots = parseTemplateSlots(
      'Appearance: {{gen:appearance:build and clothing}}\nBackground: {{gen:background}}',
    );

    expect(slots).toEqual([
      { label: 'appearance', hint: 'build and clothing' },
      { label: 'background', hint: '' },
    ]);
  });

  it('collapses repeated labels into a single slot and keeps the first hint found', () => {
    const slots = parseTemplateSlots('{{gen:mood}} ... {{gen:mood:current emotional state}} ... {{gen:Mood}}');

    expect(slots).toEqual([{ label: 'mood', hint: 'current emotional state' }]);
  });

  it('ignores pass-through macros and empty labels', () => {
    const slots = parseTemplateSlots('{{char}} meets {{user}} — {{original}} {{gen: }}');

    expect(slots).toEqual([]);
  });
});

describe('validateFieldTemplate', () => {
  it('accepts a valid strict template', () => {
    const issues = validateFieldTemplate({
      name: 'Structured Description',
      mode: TEMPLATE_MODES.strict,
      fieldKeys: [TEMPLATE_FIELD_KEYS.description],
      content: 'Appearance: {{gen:appearance}}',
    });

    expect(issues).toEqual([]);
  });

  it('flags strict templates without slots', () => {
    const issues = validateFieldTemplate({
      name: 'No Slots',
      mode: TEMPLATE_MODES.strict,
      fieldKeys: [TEMPLATE_FIELD_KEYS.description],
      content: 'Just fixed text with {{char}}.',
    });

    expect(issues.some((issue) => issue.includes('{{gen:label}}'))).toBe(true);
  });

  it('flags {{original}} bound to fields that do not support it', () => {
    const issues = validateFieldTemplate({
      name: 'Override',
      mode: TEMPLATE_MODES.prompt,
      fieldKeys: [TEMPLATE_FIELD_KEYS.system_prompt, TEMPLATE_FIELD_KEYS.description],
      content: '{{original}} Also stay concise.',
    });

    expect(issues.some((issue) => issue.includes('Description'))).toBe(true);
  });

  it('allows {{original}} for prompt override fields only', () => {
    const issues = validateFieldTemplate({
      name: 'Override',
      mode: TEMPLATE_MODES.prompt,
      fieldKeys: [TEMPLATE_FIELD_KEYS.system_prompt, TEMPLATE_FIELD_KEYS.post_history_instructions],
      content: '{{original}} Also stay concise.',
    });

    expect(issues).toEqual([]);
  });

  it('requires a name, content, and at least one bound field', () => {
    const issues = validateFieldTemplate({
      name: ' ',
      mode: TEMPLATE_MODES.prompt,
      fieldKeys: [],
      content: '',
    });

    expect(issues).toHaveLength(3);
  });
});

describe('getTemplateFieldKeyForTargetKey', () => {
  it('maps generation target keys to template field keys', () => {
    expect(getTemplateFieldKeyForTargetKey('field:description')).toBe(TEMPLATE_FIELD_KEYS.description);
    expect(getTemplateFieldKeyForTargetKey('alternate_greetings:2')).toBe(TEMPLATE_FIELD_KEYS.alternate_greeting);
    expect(getTemplateFieldKeyForTargetKey('custom:abc-123')).toBe(TEMPLATE_FIELD_KEYS.custom_field);
    expect(getTemplateFieldKeyForTargetKey('field:name')).toBeNull();
  });
});
