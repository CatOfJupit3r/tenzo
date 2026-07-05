import { describe, expect, it } from 'vitest';

import { createEmptyCharacterCard } from '../constants/card-defaults';
import { OUTPUT_FORMATS } from './generation-config';
import { buildGenerationMessages } from './prompt-builder';

describe('prompt-builder', () => {
  it('includes current card context, custom fields, and field instructions', () => {
    const card = createEmptyCharacterCard();
    card.data.name = 'Fire Keeper';
    card.data.description = 'A quiet guardian of the kiln.';
    card.data.personality = 'Warm and unhurried.';
    card.data.alternate_greetings = ['The coals are kind tonight.'];
    card.data.extensions.custom_fields = [{ id: 'weapon', label: 'Weapon', value: 'Lantern spear' }];

    const messages = buildGenerationMessages({
      card,
      target: {
        key: 'field:first_mes',
        label: 'First Message',
        value: '',
        kind: 'field',
      },
      outputFormat: OUTPUT_FORMATS.xml,
      userInstructions: 'Open with a tactile sensory detail.',
    });

    expect(messages[0]?.role).toBe('system');
    expect(messages[1]?.content).toContain('Name: Fire Keeper');
    expect(messages[1]?.content).toContain('Custom Field Weapon: Lantern spear');
    expect(messages[1]?.content).toContain('Field-specific instructions: Open with a tactile sensory detail.');
    expect(messages[1]?.content).toContain('Return the answer wrapped in a single <response> tag.');
  });

  it('applies system prompt overrides through the original placeholder', () => {
    const card = createEmptyCharacterCard();
    card.data.system_prompt = 'Prefix instructions.\n{{original}}\nSuffix instructions.';
    card.data.post_history_instructions = 'Trailing reminder.';

    const messages = buildGenerationMessages({
      card,
      target: {
        key: 'field:description',
        label: 'Description',
        value: 'Current text',
        kind: 'field',
      },
      outputFormat: OUTPUT_FORMATS.none,
    });

    expect(messages[0]?.content).toContain('Prefix instructions.');
    expect(messages[0]?.content).toContain('expert character card writing assistant');
    expect(messages[0]?.content).toContain('Suffix instructions.');
    expect(messages[2]?.content).toBe('Trailing reminder.');
  });
});
