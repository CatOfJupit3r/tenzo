import { em } from 'enumwaii';
import { z } from 'zod';

export const FIELD_WRITING_STRATEGY_ENUM = em({
  SEPARATE_FIELDS: 'separate-fields',
  COMBINED_FIELDS: 'combined-fields',
});
export const FIELD_WRITING_STRATEGIES = FIELD_WRITING_STRATEGY_ENUM.enum;
export const FIELD_WRITING_STRATEGY_SCHEMA = z.enum(FIELD_WRITING_STRATEGIES);

export type FieldWritingStrategy = z.infer<typeof FIELD_WRITING_STRATEGY_SCHEMA>;

export const FIELD_WRITING_STRATEGY_LABELS = FIELD_WRITING_STRATEGY_ENUM.derive<string>()(
  [FIELD_WRITING_STRATEGIES.SEPARATE_FIELDS, 'Separate call per field'],
  [FIELD_WRITING_STRATEGIES.COMBINED_FIELDS, 'One combined call'],
);
