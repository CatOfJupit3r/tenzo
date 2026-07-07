import { normalizeTemplateSlotLabel, TEMPLATE_SLOT_PATTERN } from './field-templates';

const CLOSED_SLOT_PATTERN = /<slot\s+name\s*=\s*["']([^"']+)["']\s*>([\s\S]*?)<\/slot>/gi;
const OPEN_SLOT_PATTERN = /<slot\s+name\s*=\s*["']([^"']+)["']\s*>([\s\S]*)$/i;

function stripCodeFence(content: string) {
  const fencedMatch = /```(?:\w+)?\n([\s\S]*?)(?:```|$)/.exec(content);
  return fencedMatch?.[1] ?? content;
}

/**
 * Extracts slot values from a (possibly partial) streamed model response of
 * `<slot name="label">value</slot>` tags. A trailing unclosed slot is included
 * with its partial value so the skeleton can fill progressively.
 */
export function parseSlotResponse(rawText: string): Record<string, string> {
  const content = stripCodeFence(rawText);
  const slotValues: Record<string, string> = {};
  let lastClosedSlotEnd = 0;

  for (const match of content.matchAll(CLOSED_SLOT_PATTERN)) {
    const label = normalizeTemplateSlotLabel(match[1] ?? '');

    if (label) {
      slotValues[label] = (match[2] ?? '').trim();
    }

    lastClosedSlotEnd = match.index + match[0].length;
  }

  const trailingContent = content.slice(lastClosedSlotEnd);
  const openMatch = OPEN_SLOT_PATTERN.exec(trailingContent);

  if (openMatch) {
    const label = normalizeTemplateSlotLabel(openMatch[1] ?? '');
    // Drop a trailing partial tag (e.g. "</slo") so it never leaks into the value.
    const partialValue = (openMatch[2] ?? '').replace(/<\/?[\w"'=\s-]*>?$/, '').trim();

    if (label && slotValues[label] === undefined) {
      slotValues[label] = partialValue;
    }
  }

  return slotValues;
}

/**
 * Substitutes slot values into a strict template skeleton. Unresolved slots
 * keep their `{{gen:label}}` token visible; all other text (including
 * `{{char}}`/`{{user}}` macros) passes through verbatim.
 */
export function renderStrictTemplate(templateContent: string, slotValues: Record<string, string>): string {
  return templateContent.replace(TEMPLATE_SLOT_PATTERN, (token, rawLabel: string | undefined) => {
    const label = normalizeTemplateSlotLabel(rawLabel ?? '');

    if (!label) {
      return token;
    }

    const value = slotValues[label];
    return value === undefined || value === '' ? token : value;
  });
}
