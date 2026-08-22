import { z } from 'zod';

import { CHARACTER_TEXT_FIELD_KEY_SCHEMA } from '../cards/card-schema';

export const AGENT_EVAL_CORPUS_VERSION = '1.0.0';

export const AGENT_EVAL_ROUTE_SCHEMA = z.enum(['advice', 'focused-edit', 'multi-field-edit', 'full-card']);
export const AGENT_EVAL_ROUTES = AGENT_EVAL_ROUTE_SCHEMA.enum;
export type AgentEvalRoute = z.infer<typeof AGENT_EVAL_ROUTE_SCHEMA>;

export const AGENT_EVAL_FAILURE_CLASS_SCHEMA = z.enum([
  'brevity',
  'coherence',
  'cross-field-repetition',
  'fidelity',
  'format',
  'long-context',
  'macro-preservation',
  'reference-copying',
  'refusal',
  'scope-drift',
  'template-preservation',
  'voice',
]);
export const AGENT_EVAL_FAILURE_CLASSES = AGENT_EVAL_FAILURE_CLASS_SCHEMA.enum;
export type AgentEvalFailureClass = z.infer<typeof AGENT_EVAL_FAILURE_CLASS_SCHEMA>;

export const AGENT_EVAL_CASE_SCHEMA = z.object({
  id: z.string().regex(/^aqo-v1-\d{3}$/),
  route: AGENT_EVAL_ROUTE_SCHEMA,
  title: z.string().trim().min(1),
  prompt: z.string().trim().min(1),
  requestedFieldKeys: z.array(CHARACTER_TEXT_FIELD_KEY_SCHEMA),
  currentFields: z.partialRecord(CHARACTER_TEXT_FIELD_KEY_SCHEMA, z.string()).optional(),
  strictTemplate: z.string().optional(),
  referenceSummary: z.string().optional(),
  priorConversationSummary: z.string().optional(),
  failureClasses: z.array(AGENT_EVAL_FAILURE_CLASS_SCHEMA).min(1),
  isMatureTheme: z.boolean(),
});
export type iAgentEvalCase = z.infer<typeof AGENT_EVAL_CASE_SCHEMA>;

export const AGENT_EVAL_RUBRIC_DIMENSION_SCHEMA = z.enum([
  'fidelity',
  'completeness',
  'specificity',
  'roleplay-usability',
  'voice',
  'format',
  'coherence',
  'non-repetition',
]);
export const AGENT_EVAL_RUBRIC_DIMENSIONS = AGENT_EVAL_RUBRIC_DIMENSION_SCHEMA.enum;
export type AgentEvalRubricDimension = z.infer<typeof AGENT_EVAL_RUBRIC_DIMENSION_SCHEMA>;
