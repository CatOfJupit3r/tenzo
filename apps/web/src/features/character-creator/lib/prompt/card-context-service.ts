import { CHARACTER_TEXT_FIELD_KEY } from '@~/features/character-creator/lib/cards/card-schema';

import type { CharacterCard, CharacterTextFieldKey } from '../cards/card-schema';
import type { iFieldGenerationTarget } from './generation-contracts';
import { GENERATION_TARGET_KINDS } from './generation-contracts';
import { PromptFormatter } from './prompt-formatting';

export const STANDARD_FIELD_LABELS = {
  name: 'Name',
  description: 'Description',
  personality: 'Personality',
  scenario: 'Scenario',
  first_mes: 'First Message',
  mes_example: 'Example Dialogue',
  creator_notes: 'Creator Notes',
  system_prompt: 'System Prompt',
  post_history_instructions: 'Post-History Instructions',
  creator: 'Creator',
  character_version: 'Version',
} satisfies Record<CharacterTextFieldKey, string>;

const CORE_CONTEXT_KEYS: CharacterTextFieldKey[] = [
  CHARACTER_TEXT_FIELD_KEY.NAME,
  CHARACTER_TEXT_FIELD_KEY.DESCRIPTION,
  CHARACTER_TEXT_FIELD_KEY.PERSONALITY,
  CHARACTER_TEXT_FIELD_KEY.SCENARIO,
  CHARACTER_TEXT_FIELD_KEY.FIRST_MES,
  CHARACTER_TEXT_FIELD_KEY.MES_EXAMPLE,
  CHARACTER_TEXT_FIELD_KEY.CREATOR_NOTES,
  CHARACTER_TEXT_FIELD_KEY.CREATOR,
  CHARACTER_TEXT_FIELD_KEY.CHARACTER_VERSION,
];

export class CardContextService {
  constructor(private readonly formatter: PromptFormatter = new PromptFormatter()) {}

  buildSection(card: CharacterCard, target: iFieldGenerationTarget): string {
    const { data } = card;
    const lines: string[] = [];

    CORE_CONTEXT_KEYS.forEach((key) => {
      const value = data[key]?.trim();
      if (!value) {
        return;
      }

      lines.push(`${STANDARD_FIELD_LABELS[key]}: ${value}`);
    });

    if (data.tags.length > 0) {
      lines.push(`Tags: ${data.tags.join(', ')}`);
    }

    if (data.alternate_greetings.length > 0) {
      data.alternate_greetings.forEach((greeting, index) => {
        if (!greeting.trim()) {
          return;
        }

        const isTargetGreeting =
          target.kind === GENERATION_TARGET_KINDS.ALTERNATE_GREETING && target.key === `alternate_greetings:${index}`;
        lines.push(`Alternate Greeting ${index + 1}${isTargetGreeting ? ' (target)' : ''}: ${greeting.trim()}`);
      });
    }

    if (data.extensions.custom_fields.length > 0) {
      data.extensions.custom_fields.forEach((field) => {
        if (!field.label.trim() && !field.value.trim()) {
          return;
        }

        const isTargetCustomField =
          target.kind === GENERATION_TARGET_KINDS.CUSTOM_FIELD && target.key === `custom:${field.id}`;
        lines.push(
          `Custom Field ${field.label.trim() !== '' ? field.label.trim() : 'Untitled'}${isTargetCustomField ? ' (target)' : ''}: ${field.value.trim() !== '' ? field.value.trim() : '(empty)'}`,
        );
      });
    }

    if (lines.length === 0) {
      return '';
    }

    return ['Current card context:', this.formatter.formatBulletList(lines)].join('\n');
  }
}
