import { describe, expect, it } from 'vitest';

import { DEFAULT_FIELD_TEMPLATE_IDS } from '../../constants/default-field-templates';
import { resolveEffectiveFieldTemplateId } from './field-template-resolution';
import { FIELD_TEMPLATE_SELECTION_NONE } from './field-templates';

describe('resolveEffectiveFieldTemplateId', () => {
  it('prefers an explicit template over the built-in default', () => {
    expect(
      resolveEffectiveFieldTemplateId({
        fieldTemplateIds: { 'field:description': 'custom-description' },
        shouldUseDefaultFieldTemplates: true,
        targetKey: 'field:description',
      }),
    ).toBe('custom-description');
  });

  it('uses the none sentinel to opt out of the built-in default', () => {
    expect(
      resolveEffectiveFieldTemplateId({
        fieldTemplateIds: { 'field:description': FIELD_TEMPLATE_SELECTION_NONE },
        shouldUseDefaultFieldTemplates: true,
        targetKey: 'field:description',
      }),
    ).toBeNull();
  });

  it('falls back to a built-in template when defaults are enabled', () => {
    expect(
      resolveEffectiveFieldTemplateId({
        fieldTemplateIds: {},
        shouldUseDefaultFieldTemplates: true,
        targetKey: 'field:description',
      }),
    ).toBe(DEFAULT_FIELD_TEMPLATE_IDS['field:description']);
  });

  it('returns no template when defaults are disabled or no default exists', () => {
    expect(
      resolveEffectiveFieldTemplateId({
        fieldTemplateIds: {},
        shouldUseDefaultFieldTemplates: false,
        targetKey: 'field:description',
      }),
    ).toBeNull();
    expect(
      resolveEffectiveFieldTemplateId({
        fieldTemplateIds: {},
        shouldUseDefaultFieldTemplates: true,
        targetKey: 'field:creator_notes',
      }),
    ).toBeNull();
  });

  it('maps alternate greeting generation targets to the greeting default', () => {
    expect(
      resolveEffectiveFieldTemplateId({
        fieldTemplateIds: {},
        shouldUseDefaultFieldTemplates: true,
        targetKey: 'alternate_greetings:2',
      }),
    ).toBe(DEFAULT_FIELD_TEMPLATE_IDS['field:alternate_greeting']);
  });
});
