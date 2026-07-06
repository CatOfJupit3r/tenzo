import type { CardContextService } from './card-context-service';
import { PROMPT_SECTION_NAMES } from './prompt-section-strategy';
import type { iPromptPipelineContext, iPromptSectionStrategy } from './prompt-section-strategy';

export class CardContextSectionStrategy implements iPromptSectionStrategy {
  readonly name = PROMPT_SECTION_NAMES['card-context'];

  constructor(private readonly cardContextService: CardContextService) {}

  build(context: iPromptPipelineContext): string {
    return this.cardContextService.buildSection(context.card, context.target);
  }
}
