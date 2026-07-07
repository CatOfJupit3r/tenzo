import {
  getContinuationFormatInstructions,
  getFormatInstructions,
  getStrictTemplateFormatInstructions,
} from '../../constants/default-prompts';
import { parseTemplateSlots, TEMPLATE_MODES } from '../field-templates';
import { PROMPT_SECTION_NAMES } from './prompt-section-strategy';
import type { iPromptPipelineContext, iPromptSectionStrategy } from './prompt-section-strategy';
import type { TaskInstructionService } from './task-instruction-service';

export class TaskSectionStrategy implements iPromptSectionStrategy {
  readonly name = PROMPT_SECTION_NAMES.task;

  constructor(private readonly taskInstructionService: TaskInstructionService) {}

  build(context: iPromptPipelineContext): string {
    const { target, mode, exampleContextSummary, fieldTemplate } = context;
    const isStrictTemplate = fieldTemplate?.mode === TEMPLATE_MODES.strict;

    return [
      `Your task is to write the "${target.label}" field for a SillyTavern V2 character card.`,
      this.taskInstructionService.getTaskInstruction(target, mode),
      'Keep the result consistent with the rest of the card.',
      this.taskInstructionService.getFieldFormatGuidance(target),
      exampleContextSummary.isTruncated
        ? `Reference example content was truncated to stay within the ${context.maxExampleContextCharacters}-character context budget. Use only the included reference details.`
        : '',
      context.shouldUseGeneralCharacterIdea && context.generalCharacterIdea.trim()
        ? `General character idea: ${context.generalCharacterIdea.trim()}`
        : '',
      context.userInstructions.trim() ? `Field-specific instructions: ${context.userInstructions.trim()}` : '',
      context.variationSection,
      this.resolveFormatInstructions(context, isStrictTemplate),
    ]
      .filter(Boolean)
      .join('\n');
  }

  private resolveFormatInstructions(context: iPromptPipelineContext, isStrictTemplate: boolean): string {
    if (context.isContinuation) {
      return getContinuationFormatInstructions(context.outputFormat);
    }

    if (isStrictTemplate && context.fieldTemplate) {
      return getStrictTemplateFormatInstructions(parseTemplateSlots(context.fieldTemplate.content));
    }

    return getFormatInstructions(context.outputFormat);
  }
}
