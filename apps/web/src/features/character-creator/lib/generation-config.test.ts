import { describe, expect, it } from 'vitest';

import {
  CHARACTER_GENERATION_PROMPT_SETTINGS_SCHEMA,
  DEFAULT_CHARACTER_GENERATION_PROMPT_SETTINGS,
} from './generation-config';

describe('CHARACTER_GENERATION_PROMPT_SETTINGS_SCHEMA', () => {
  it('defaults field template IDs for stored prompt settings that predate templates', () => {
    const result = CHARACTER_GENERATION_PROMPT_SETTINGS_SCHEMA.safeParse({
      generalCharacterIdea: 'A detective',
      fieldInstructions: {},
      fieldShouldUseGeneralCharacterIdea: {},
    });

    expect(result).toEqual({
      success: true,
      data: {
        generalCharacterIdea: 'A detective',
        fieldInstructions: {},
        fieldShouldUseGeneralCharacterIdea: {},
        fieldTemplateIds: DEFAULT_CHARACTER_GENERATION_PROMPT_SETTINGS.fieldTemplateIds,
      },
    });
  });
});
