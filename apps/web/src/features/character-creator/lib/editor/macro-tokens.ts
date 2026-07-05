import z from 'zod';

export const macroKindSchema = z.enum(['char', 'user', 'original', 'unknown']);
export const MACRO_KINDS = macroKindSchema.enum;
export type MacroKind = z.infer<typeof macroKindSchema>;

export interface iMacroRange {
  from: number;
  to: number;
  kind: MacroKind;
}

export interface iFindMacroRangesOptions {
  doesAllowOriginalMacro: boolean;
}

const MACRO_PATTERN = /\{\{\s*([a-zA-Z_][\w]*)\s*\}\}/g;

export function findMacroRanges(text: string, options: iFindMacroRangesOptions): iMacroRange[] {
  const ranges: iMacroRange[] = [];
  for (const match of text.matchAll(MACRO_PATTERN)) {
    const name = match[1]?.toLowerCase();
    let kind: MacroKind;
    if (name === 'char' || name === 'user') {
      kind = MACRO_KINDS[name];
    } else if (name === 'original' && options.doesAllowOriginalMacro) {
      kind = MACRO_KINDS.original;
    } else {
      kind = MACRO_KINDS.unknown;
    }
    ranges.push({ from: match.index, to: match.index + match[0].length, kind });
  }
  return ranges;
}
