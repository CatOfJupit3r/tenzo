import { z } from 'zod';

export const GUIDED_STEP_ID_SCHEMA = z.enum([
  'concept',
  'appearance',
  'personality',
  'scenario',
  'voice',
  'metadata',
  'review',
]);

export type GuidedStepId = z.infer<typeof GUIDED_STEP_ID_SCHEMA>;
