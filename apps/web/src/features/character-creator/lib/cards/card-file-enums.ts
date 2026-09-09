import { em } from 'enumwaii';
import { z } from 'zod';

export const IMPORTED_CARD_SOURCE_KIND_ENUM = em({
  JSON: 'json',
  PNG: 'png',
});
export const IMPORTED_CARD_SOURCE_KINDS = IMPORTED_CARD_SOURCE_KIND_ENUM.enum;
export const IMPORTED_CARD_SOURCE_KIND_SCHEMA = z.enum(IMPORTED_CARD_SOURCE_KINDS);
export type ImportedCardSourceKind = z.infer<typeof IMPORTED_CARD_SOURCE_KIND_SCHEMA>;

export const IMPORTED_ARCHIVE_KIND_ENUM = em(['BACKUP', 'CARDS']);
export const IMPORTED_ARCHIVE_KINDS_CASES = IMPORTED_ARCHIVE_KIND_ENUM.cases;

export const CHARACTER_CARD_SPEC_ENUM = em({
  CHARA_CARD_V2: 'chara_card_v2',
});
export const CHARACTER_CARD_SPECS = CHARACTER_CARD_SPEC_ENUM.enum;

export const CHARACTER_CARD_SPEC_VERSION_ENUM = em({
  VALUE_2_0: '2.0',
});
export const CHARACTER_CARD_SPEC_VERSIONS = CHARACTER_CARD_SPEC_VERSION_ENUM.enum;
