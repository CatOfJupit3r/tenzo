import z from 'zod';

export const mesExampleLineKindSchema = z.enum(['start', 'charTurn', 'userTurn', 'plain']);
export const MES_EXAMPLE_LINE_KINDS = mesExampleLineKindSchema.enum;
export type MesExampleLineKind = z.infer<typeof mesExampleLineKindSchema>;

const START_LINE_PATTERN = /^\s*<start>\s*$/i;
const SPEAKER_PREFIX_PATTERN = /^\s*\{\{(char|user)\}\}:/i;

export function classifyMesExampleLine(line: string): MesExampleLineKind {
  if (START_LINE_PATTERN.test(line)) {
    return MES_EXAMPLE_LINE_KINDS.start;
  }
  const speakerMatch = SPEAKER_PREFIX_PATTERN.exec(line);
  if (speakerMatch) {
    return speakerMatch[1]?.toLowerCase() === 'char'
      ? MES_EXAMPLE_LINE_KINDS.charTurn
      : MES_EXAMPLE_LINE_KINDS.userTurn;
  }
  return MES_EXAMPLE_LINE_KINDS.plain;
}

export function getSpeakerPrefixLength(line: string): number {
  const speakerMatch = SPEAKER_PREFIX_PATTERN.exec(line);
  return speakerMatch ? speakerMatch[0].length : 0;
}
