import type { CharacterTextFieldKey } from '../card-schema';
import { GENERATION_MODES, GENERATION_TARGET_KINDS } from './generation-contracts';
import type { GenerationMode, iFieldGenerationTarget } from './generation-contracts';

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

const FIELD_FORMAT_GUIDANCE: Partial<Record<CharacterTextFieldKey, string>> = {
  first_mes: GREETING_FORMAT_GUIDANCE,
  mes_example: MES_EXAMPLE_FORMAT_GUIDANCE,
  description: OUT_OF_CHARACTER_FIELD_GUIDANCE,
  personality: `${OUT_OF_CHARACTER_FIELD_GUIDANCE} Keep it a concise trait summary rather than prose narration.`,
  scenario: `${OUT_OF_CHARACTER_FIELD_GUIDANCE} Describe the setting/situation, not what happens in it.`,
  creator_notes: `Write this as out-of-character notes for other creators or users browsing the card (e.g., content warnings, usage tips) — not as in-character content.`,
  system_prompt: `Write this as a meta-instruction telling the roleplay AI how to portray {{char}} — not as in-character content.`,
  post_history_instructions: `Write this as a meta-instruction reinforced after the chat history, telling the roleplay AI how to keep portraying {{char}} — not as in-character content.`,
};

export function getFieldFormatGuidance(target: iFieldGenerationTarget) {
  if (target.kind === GENERATION_TARGET_KINDS['alternate-greeting']) {
    return GREETING_FORMAT_GUIDANCE;
  }

  if (target.kind === GENERATION_TARGET_KINDS.field) {
    const fieldKey = target.key.replace(/^field:/, '') as CharacterTextFieldKey;
    return FIELD_FORMAT_GUIDANCE[fieldKey] ?? '';
  }

  return '';
}

export function getTaskInstruction(target: iFieldGenerationTarget, mode: GenerationMode) {
  if (!target.value.trim()) {
    return `The current ${target.label} value is empty. Create it from scratch based on the available card context.`;
  }

  if (mode === GENERATION_MODES.rewrite) {
    return `Rewrite the current ${target.label} value provided in the context above according to the instructions below. Replace it entirely instead of continuing or appending to it.`;
  }

  if (mode === GENERATION_MODES.continue) {
    return `The current ${target.label} value is provided in the context above and has already been started as your reply below. Continue it directly from where it leaves off; do not restart, summarize, or repeat it.`;
  }

  return `The current ${target.label} value is provided in the context above. Improve or continue it only when the request context implies that.`;
}
