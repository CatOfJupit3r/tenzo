import type { iPromptPipelineContext, iPromptSectionStrategy } from './prompt-section-strategy';
import { PROMPT_SECTION_NAMES } from './prompt-section-strategy';
import type { TemplateService } from './template-service';

export class TemplateSectionStrategy implements iPromptSectionStrategy {
  readonly name = PROMPT_SECTION_NAMES.TEMPLATE;

  constructor(private readonly templateService: TemplateService) {}

  build(context: iPromptPipelineContext): string {
    return this.templateService.buildSection(context.fieldTemplate);
  }
}
