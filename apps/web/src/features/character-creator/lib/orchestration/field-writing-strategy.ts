import { z } from 'zod';

export const FIELD_WRITING_STRATEGY_SCHEMA = z.enum(['separate-fields', 'combined-fields']);
export const FIELD_WRITING_STRATEGIES = FIELD_WRITING_STRATEGY_SCHEMA.enum;
export type FieldWritingStrategy = z.infer<typeof FIELD_WRITING_STRATEGY_SCHEMA>;

export const FIELD_WRITING_STRATEGY_LABELS = {
  [FIELD_WRITING_STRATEGIES['separate-fields']]: 'Separate call per field',
  [FIELD_WRITING_STRATEGIES['combined-fields']]: 'One combined call',
} satisfies Record<FieldWritingStrategy, string>;
