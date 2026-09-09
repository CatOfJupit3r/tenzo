import type { CardContextService } from './card-context-service';
import type { iPromptPipelineContext, iPromptSectionStrategy } from './prompt-section-strategy';
import { PROMPT_SECTION_NAMES } from './prompt-section-strategy';

export class CardContextSectionStrategy implements iPromptSectionStrategy {
  readonly name = PROMPT_SECTION_NAMES.CARD_CONTEXT;

  constructor(private readonly cardContextService: CardContextService) {}

  build(context: iPromptPipelineContext): string {
    return this.cardContextService.buildSection(context.card, context.target);
  }
}
