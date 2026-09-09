import { CHARACTER_FIELD_KEYS, CHARACTER_TEXT_FIELD_KEY_ENUM } from '../cards/card-schema';
import type { GenerationMode, iFieldGenerationTarget } from './generation-contracts';
import { GENERATION_MODES, GENERATION_TARGET_KINDS } from './generation-contracts';

const GREETING_FORMAT_GUIDANCE = `Write this as {{char}}'s literal in-character opening message to {{user}}, ready to send as-is — not a description of the message.
- May combine spoken dialogue with *narrated actions/thoughts in asterisks*.
- Preserve {{char}} and {{user}} macros verbatim.
- Do not generate overcomplicated or 3+ paragraph greetings. Keep it concise and natural.
- Do not include speech or actions for user`;

const MES_EXAMPLE_FORMAT_GUIDANCE = `Format this using SillyTavern's example-dialogue syntax:
- Start every example exchange with a line containing only <START>.
- Write each turn on its own line prefixed with "{{char}}:" or "{{user}}:".
- You may include multiple <START>-separated examples.
- Do not produce more than 2 paragraphs of dialogue per example exchange.`;

const OUT_OF_CHARACTER_FIELD_GUIDANCE = `Write this as out-of-character reference notes for the roleplay AI — not as in-character dialogue or narration.`;

const GENERAL_CHARACTER_IDEA_FORMAT_GUIDANCE = `Write a concise, high-level character concept that can guide generation of every card field. Focus on the character's core identity, tone, roleplay premise, and defining traits. Do not write dialogue, JSON, or field labels.`;

export const FIELD_FORMAT_GUIDANCE = CHARACTER_TEXT_FIELD_KEY_ENUM.derive<string>()(
  [CHARACTER_FIELD_KEYS.FIRST_MES, GREETING_FORMAT_GUIDANCE],
  [CHARACTER_FIELD_KEYS.MES_EXAMPLE, MES_EXAMPLE_FORMAT_GUIDANCE],
  [CHARACTER_FIELD_KEYS.DESCRIPTION, OUT_OF_CHARACTER_FIELD_GUIDANCE],
  [
    CHARACTER_FIELD_KEYS.PERSONALITY,
    `${OUT_OF_CHARACTER_FIELD_GUIDANCE} Keep it a concise trait summary rather than prose narration.`,
  ],
  [
    CHARACTER_FIELD_KEYS.SCENARIO,
    `${OUT_OF_CHARACTER_FIELD_GUIDANCE} Describe the setting/situation, not what happens in it.`,
  ],
  [
    CHARACTER_FIELD_KEYS.CREATOR_NOTES,
    `Write this as out-of-character notes for other creators or users browsing the card (e.g., content warnings, usage tips) — not as in-character content.`,
  ],
  [
    CHARACTER_FIELD_KEYS.SYSTEM_PROMPT,
    `Write this as a meta-instruction telling the roleplay AI how to portray {{char}} — not as in-character content.`,
  ],
  [
    CHARACTER_FIELD_KEYS.POST_HISTORY_INSTRUCTIONS,
    `Write this as a meta-instruction reinforced after the chat history, telling the roleplay AI how to keep portraying {{char}} — not as in-character content.`,
  ],
  [CHARACTER_FIELD_KEYS.NAME, ''],
  [CHARACTER_FIELD_KEYS.CREATOR, ''],
  [CHARACTER_FIELD_KEYS.CHARACTER_VERSION, ''],
);

export class TaskInstructionService {
  getFieldFormatGuidance(target: iFieldGenerationTarget): string {
    if (target.kind === GENERATION_TARGET_KINDS.GENERAL_CHARACTER_IDEA) {
      return GENERAL_CHARACTER_IDEA_FORMAT_GUIDANCE;
    }

    if (target.kind === GENERATION_TARGET_KINDS.ALTERNATE_GREETING) {
      return GREETING_FORMAT_GUIDANCE;
    }

    if (target.kind === GENERATION_TARGET_KINDS.FIELD) {
      const fieldKey = CHARACTER_TEXT_FIELD_KEY_ENUM.parse(target.key.replace(/^field:/, ''));
      return FIELD_FORMAT_GUIDANCE.get(fieldKey);
    }

    return '';
  }

  getTaskInstruction(target: iFieldGenerationTarget, mode: GenerationMode): string {
    if (!target.value.trim()) {
      return `The current ${target.label} value is empty. Create it from scratch based on the available card context.`;
    }

    if (mode === GENERATION_MODES.REWRITE) {
      return `Rewrite the current ${target.label} value provided in the context above according to the instructions below. Replace it entirely instead of continuing or appending to it.`;
    }

    if (mode === GENERATION_MODES.CONTINUE) {
      return `The current ${target.label} value is provided in the context above and has already been started as your reply below. Continue it directly from where it leaves off; do not restart, summarize, or repeat it.`;
    }

    return `The current ${target.label} value is provided in the context above. Improve or continue it only when the request context implies that.`;
  }
}
