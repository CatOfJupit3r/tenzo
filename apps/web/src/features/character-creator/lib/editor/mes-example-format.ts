import { em } from 'enumwaii';
import z from 'zod';

import { MACRO_KINDS } from '@~/features/character-creator/lib/editor/macro-tokens';

export const mesExampleLineKindEnum = em(['START', 'CHAR_TURN', 'USER_TURN', 'PLAIN']);
export const MES_EXAMPLE_LINE_KINDS = mesExampleLineKindEnum.enum;
export const mesExampleLineKindSchema = z.enum(MES_EXAMPLE_LINE_KINDS);

export type MesExampleLineKind = z.infer<typeof mesExampleLineKindSchema>;

const START_LINE_PATTERN = /^\s*<start>\s*$/i;
const SPEAKER_PREFIX_PATTERN = /^\s*\{\{(char|user)\}\}:/i;

export function classifyMesExampleLine(line: string): MesExampleLineKind {
  if (START_LINE_PATTERN.test(line)) {
    return MES_EXAMPLE_LINE_KINDS.START;
  }
  const speakerMatch = SPEAKER_PREFIX_PATTERN.exec(line);
  if (speakerMatch) {
    return speakerMatch[1]?.toLowerCase() === MACRO_KINDS.CHAR
      ? MES_EXAMPLE_LINE_KINDS.CHAR_TURN
      : MES_EXAMPLE_LINE_KINDS.USER_TURN;
  }
  return MES_EXAMPLE_LINE_KINDS.PLAIN;
}

export function getSpeakerPrefixLength(line: string): number {
  const speakerMatch = SPEAKER_PREFIX_PATTERN.exec(line);
  return speakerMatch ? speakerMatch[0].length : 0;
}
