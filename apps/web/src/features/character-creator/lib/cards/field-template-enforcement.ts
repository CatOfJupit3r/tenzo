import { TEMPLATE_SLOT_PATTERN } from './field-templates';

function getLiteralSegments(content: string) {
  const segments: string[] = [];
  let previousEnd = 0;

  const slotPattern = new RegExp(TEMPLATE_SLOT_PATTERN.source, TEMPLATE_SLOT_PATTERN.flags);

  for (const match of content.matchAll(slotPattern)) {
    const matchStart = match.index ?? previousEnd;
    segments.push(content.slice(previousEnd, matchStart));
    previousEnd = matchStart + match[0].length;
  }

  segments.push(content.slice(previousEnd));
  return segments;
}

/** Returns true when a value preserves every literal part of a strict skeleton. */
export function doesValueMatchStrictFieldTemplate(templateContent: string, value: string) {
  const literalSegments = getLiteralSegments(templateContent);
  const firstSegment = literalSegments[0] ?? '';

  if (!value.startsWith(firstSegment)) {
    return false;
  }

  let cursor = firstSegment.length;

  for (const segment of literalSegments.slice(1)) {
    const segmentStart = value.indexOf(segment, cursor);

    if (segmentStart < 0) {
      return false;
    }

    cursor = segmentStart + segment.length;
  }

  return literalSegments.at(-1) === '' ? cursor <= value.length : cursor === value.length;
}
