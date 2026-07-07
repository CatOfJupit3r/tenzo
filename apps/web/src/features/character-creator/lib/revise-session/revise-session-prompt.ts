import type { CharacterCard, CharacterTextFieldKey } from '../card-schema';
import { CardContextService, STANDARD_FIELD_LABELS } from '../prompt/card-context-service';
import { GENERATION_MODES, GENERATION_TARGET_KINDS } from '../prompt/generation-contracts';
import { TaskInstructionService } from '../prompt/task-instruction-service';

const cardContextService = new CardContextService();
const taskInstructionService = new TaskInstructionService();

export interface iReviseSessionPromptInput {
  card: CharacterCard;
  fieldKey: CharacterTextFieldKey;
  generalCharacterIdea?: string;
  fieldInstruction?: string;
}

function createFieldTarget(card: CharacterCard, fieldKey: CharacterTextFieldKey) {
  return {
    key: `field:${fieldKey}`,
    label: STANDARD_FIELD_LABELS[fieldKey],
    value: card.data[fieldKey],
    kind: GENERATION_TARGET_KINDS.field,
  } as const;
}

export function buildReviseSessionSystemPrompt({ card, fieldKey }: iReviseSessionPromptInput) {
  const target = createFieldTarget(card, fieldKey);
  const fieldFormatGuidance = taskInstructionService.getFieldFormatGuidance(target);

  const sections = [
    'You are an iterative revise-session assistant for a character card editor.',
    `You are editing exactly one field: ${target.label}.`,
    'Every assistant reply must be the complete updated field value after applying the latest user request.',
    'Do not explain your changes.',
    'Do not include headings, labels, markdown fences, XML wrappers, bullet lists, or surrounding quotes unless the field content itself genuinely requires them.',
    'Preserve roleplay macros such as {{char}} and {{user}} when they belong in the field.',
    fieldFormatGuidance ? `Field format guidance:\n${fieldFormatGuidance}` : null,
  ].filter((section): section is string => Boolean(section));

  return sections.join('\n\n');
}

export function buildReviseSessionContextPrompt({
  card,
  fieldKey,
  generalCharacterIdea = '',
  fieldInstruction = '',
}: iReviseSessionPromptInput) {
  const target = createFieldTarget(card, fieldKey);
  const cardContextSection = cardContextService.buildSection(card, target);
  const sections = [
    cardContextSection || 'Current card context: (empty)',
    `Current ${target.label} value:\n${target.value.trim() || '(empty)'}`,
    `Revision task:\n${taskInstructionService.getTaskInstruction(target, GENERATION_MODES.rewrite)}`,
    generalCharacterIdea.trim() ? `General character idea:\n${generalCharacterIdea.trim()}` : null,
    fieldInstruction.trim() ? `Standing field instruction:\n${fieldInstruction.trim()}` : null,
    'Use the conversation that follows as iterative revision feedback for this same field.',
  ].filter((section): section is string => Boolean(section));

  return sections.join('\n\n');
}
