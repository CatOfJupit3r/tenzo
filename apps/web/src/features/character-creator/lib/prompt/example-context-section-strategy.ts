import { PROMPT_SECTION_NAMES } from './prompt-section-strategy';
import type { iPromptPipelineContext, iPromptSectionStrategy } from './prompt-section-strategy';

export class ExampleContextSectionStrategy implements iPromptSectionStrategy {
  readonly name = PROMPT_SECTION_NAMES['example-context'];

  build(context: iPromptPipelineContext): string {
    return context.exampleContextSummary.section;
  }
}
