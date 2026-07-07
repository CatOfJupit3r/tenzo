import { parseTemplateSlots, TEMPLATE_MODES } from '../field-templates';
import type { iPromptFieldTemplate } from './generation-contracts';

export class TemplateService {
  isStrict(fieldTemplate: iPromptFieldTemplate | null): boolean {
    return fieldTemplate?.mode === TEMPLATE_MODES.strict;
  }

  buildSection(fieldTemplate: iPromptFieldTemplate | null): string {
    if (!fieldTemplate?.content.trim()) {
      return '';
    }

    if (fieldTemplate.mode === TEMPLATE_MODES.strict) {
      return this.buildStrictSection(fieldTemplate);
    }

    return [
      `Field structure template "${fieldTemplate.name}" — use it as guidance for the structure, ordering, and depth of the field. Adapt the actual content freely to this character; do not copy placeholder or example wording verbatim.`,
      'Template:',
      fieldTemplate.content.trim(),
    ].join('\n');
  }

  private buildStrictSection(fieldTemplate: iPromptFieldTemplate): string {
    const slots = parseTemplateSlots(fieldTemplate.content);
    const slotLines = slots.map((slot) => (slot.hint ? `- ${slot.label} — ${slot.hint}` : `- ${slot.label}`));

    return [
      `Strict field template "${fieldTemplate.name}". The final field value is assembled from the fixed skeleton below; every part outside the {{gen:...}} slots is kept exactly as written. Your job is to write the slot values only.`,
      'Skeleton:',
      fieldTemplate.content.trim(),
      'Slots to fill:',
      ...slotLines,
    ].join('\n');
  }
}
