import { TEMPLATE_FIELD_KEY_LABELS, TEMPLATE_MODE_LABELS, TEMPLATE_MODES } from '../cards/field-templates';
import type { iFieldTemplateViewModel } from '../cards/field-templates';
import { ExampleContextService } from '../prompt/example-context-service';
import type { iGenerationMessage, iPromptExampleCharacter } from '../prompt/generation-contracts';

export const MAX_TEMPLATE_ENHANCEMENT_REFERENCE_COUNT = 4;

export interface iBuildTemplateEnhancementMessagesOptions {
  targetTemplate: iFieldTemplateViewModel;
  referenceTemplates: iFieldTemplateViewModel[];
  exampleCharacters: iPromptExampleCharacter[];
  guidance: string;
}

function formatTemplate(template: iFieldTemplateViewModel) {
  const fieldLabels = template.fieldKeys.map((fieldKey) => TEMPLATE_FIELD_KEY_LABELS[fieldKey]);

  return [
    `Name: ${template.name || 'Untitled template'}`,
    `Mode: ${TEMPLATE_MODE_LABELS[template.mode]}`,
    `Fields: ${fieldLabels.join(', ') || 'Unbound'}`,
    template.description.trim() ? `Notes: ${template.description.trim()}` : '',
    'Content:',
    template.content,
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildTemplateEnhancementMessages({
  targetTemplate,
  referenceTemplates,
  exampleCharacters,
  guidance,
}: iBuildTemplateEnhancementMessagesOptions): iGenerationMessage[] {
  const exampleSection = new ExampleContextService().buildSummary({ exampleCharacters }).section;
  const referenceTemplateSection = referenceTemplates
    .slice(0, MAX_TEMPLATE_ENHANCEMENT_REFERENCE_COUNT)
    .map((template, index) => `Reference template ${index + 1}:\n${formatTemplate(template)}`)
    .join('\n\n');
  const strictModeInstruction =
    targetTemplate.mode === TEMPLATE_MODES.strict
      ? [
          'This is a strict skeleton template.',
          'Return a complete fixed skeleton containing one or more valid {{gen:label}} or {{gen:label:hint}} slots.',
          'Preserve useful existing slots unless the guidance clearly calls for changing them.',
          'Do not replace slots with generated character content.',
        ].join(' ')
      : 'This is prompt guidance. Improve its structure, specificity, and usefulness to a character-writing model.';

  return [
    {
      role: 'system',
      content: [
        'You improve reusable character field templates.',
        'Return only the complete enhanced template content with no preamble, commentary, or Markdown code fence.',
        'Treat all reference characters and templates as non-copyable inspiration for structure, depth, and quality.',
        'Do not reuse distinctive names, phrases, plot elements, or prose from reference material.',
        strictModeInstruction,
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        'Template to enhance:',
        formatTemplate(targetTemplate),
        referenceTemplateSection ? `Other reusable templates:\n${referenceTemplateSection}` : '',
        exampleSection,
        guidance.trim()
          ? `User guidance:\n${guidance.trim()}`
          : 'User guidance:\nImprove this template while preserving its intent.',
      ]
        .filter(Boolean)
        .join('\n\n'),
    },
  ];
}

export function normalizeTemplateEnhancementResponse(content: string) {
  const trimmedContent = content.trim();
  const fencedContentMatch = /^```(?:markdown|md|text)?\s*\n([\s\S]*?)\n```$/i.exec(trimmedContent);

  return (fencedContentMatch?.[1] ?? trimmedContent).trim();
}
