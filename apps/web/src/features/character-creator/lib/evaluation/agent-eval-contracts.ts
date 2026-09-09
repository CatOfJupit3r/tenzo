import { em } from 'enumwaii';
import { z } from 'zod';

import { CHARACTER_TEXT_FIELD_KEY_SCHEMA } from '../cards/card-schema';
import { AGENT_ROUTE_SCHEMA } from '../orchestration/agent-orchestration-contracts';

export const AGENT_EVAL_CORPUS_VERSION = '1.0.0';

export const AGENT_EVAL_FAILURE_CLASS_ENUM = em([
  'BREVITY',
  'COHERENCE',
  'CROSS_FIELD_REPETITION',
  'FIDELITY',
  'FORMAT',
  'LONG_CONTEXT',
  'MACRO_PRESERVATION',
  'REFERENCE_COPYING',
  'REFUSAL',
  'SCOPE_DRIFT',
  'TEMPLATE_PRESERVATION',
  'VOICE',
]);
export const AGENT_EVAL_FAILURE_CLASSES = AGENT_EVAL_FAILURE_CLASS_ENUM.enum;
export const AGENT_EVAL_FAILURE_CLASS_SCHEMA = z.enum(AGENT_EVAL_FAILURE_CLASSES);

export type AgentEvalFailureClass = z.infer<typeof AGENT_EVAL_FAILURE_CLASS_SCHEMA>;

export const AGENT_EVAL_CASE_SCHEMA = z.object({
  id: z.string().regex(/^aqo-v1-\d{3}$/),
  route: AGENT_ROUTE_SCHEMA,
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

export const AGENT_EVAL_RUBRIC_DIMENSION_ENUM = em([
  'FIDELITY',
  'COMPLETENESS',
  'SPECIFICITY',
  'ROLEPLAY_USABILITY',
  'VOICE',
  'FORMAT',
  'COHERENCE',
  'NON_REPETITION',
]);
export const AGENT_EVAL_RUBRIC_DIMENSIONS = AGENT_EVAL_RUBRIC_DIMENSION_ENUM.enum;
export const AGENT_EVAL_RUBRIC_DIMENSION_SCHEMA = z.enum(AGENT_EVAL_RUBRIC_DIMENSIONS);

export type AgentEvalRubricDimension = z.infer<typeof AGENT_EVAL_RUBRIC_DIMENSION_SCHEMA>;
