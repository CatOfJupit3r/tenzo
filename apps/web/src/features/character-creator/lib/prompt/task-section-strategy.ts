import { getContinuationFormatInstructions, getFormatInstructions } from '../../constants/default-prompts';
import { PROMPT_SECTION_NAMES } from './prompt-section-strategy';
import type { iPromptPipelineContext, iPromptSectionStrategy } from './prompt-section-strategy';
import type { TaskInstructionService } from './task-instruction-service';

export class TaskSectionStrategy implements iPromptSectionStrategy {
  readonly name = PROMPT_SECTION_NAMES.task;

  constructor(private readonly taskInstructionService: TaskInstructionService) {}

  build(context: iPromptPipelineContext): string {
    const { target, mode, outputFormat, exampleContextSummary, isContinuation } = context;

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
      isContinuation ? getContinuationFormatInstructions(outputFormat) : getFormatInstructions(outputFormat),
    ]
      .filter(Boolean)
      .join('\n');
  }
}
