import { em } from 'enumwaii';
import z from 'zod';

import { TEMPLATE_SLOT_PATTERN } from '../cards/field-templates';

export const macroKindEnum = em({
  CHAR: 'char',
  USER: 'user',
  ORIGINAL: 'original',
  SLOT: 'slot',
  UNKNOWN: 'unknown',
});
export const MACRO_KINDS = macroKindEnum.enum;
export const macroKindSchema = z.enum(MACRO_KINDS);

export type MacroKind = z.infer<typeof macroKindSchema>;

export interface iMacroRange {
  from: number;
  to: number;
  kind: MacroKind;
}

export interface iFindMacroRangesOptions {
  doesAllowOriginalMacro: boolean;
  doesHighlightTemplateSlots?: boolean;
}

const MACRO_PATTERN = /\{\{\s*([a-zA-Z_][\w]*)\s*\}\}/g;

export function findMacroRanges(text: string, options: iFindMacroRangesOptions): iMacroRange[] {
  const ranges: iMacroRange[] = [];
  for (const match of text.matchAll(MACRO_PATTERN)) {
    const name = match[1]?.toLowerCase();
    let kind: MacroKind;
    if (name === MACRO_KINDS.CHAR || name === MACRO_KINDS.USER) {
      kind = macroKindEnum.parse(name);
    } else if (name === MACRO_KINDS.ORIGINAL && options.doesAllowOriginalMacro) {
      kind = MACRO_KINDS.ORIGINAL;
    } else {
      kind = MACRO_KINDS.UNKNOWN;
    }
    ranges.push({ from: match.index, to: match.index + match[0].length, kind });
  }
  if (options.doesHighlightTemplateSlots) {
    // Slot tokens contain ':' so they never overlap MACRO_PATTERN matches.
    for (const match of text.matchAll(TEMPLATE_SLOT_PATTERN)) {
      ranges.push({ from: match.index, to: match.index + match[0].length, kind: MACRO_KINDS.SLOT });
    }
    ranges.sort((a, b) => a.from - b.from);
  }
  return ranges;
}
