import { z } from 'zod';

import { CHARACTER_TEXT_FIELD_KEY_SCHEMA } from '../cards/card-schema';

export const AGENT_EVAL_CORPUS_VERSION = '1.0.0';
export const SINGLE_AGENT_BASELINE_REVISION = '3aabb08a6bbfb62373742d8da93b99d435deffb4';

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

export const AGENT_EVAL_RUBRIC_SCORE_SCHEMA = z.number().int().min(1).max(5);

export const AGENT_EVAL_FIELD_SCORE_SCHEMA = z.object({
  fieldKey: CHARACTER_TEXT_FIELD_KEY_SCHEMA,
  scores: z.record(AGENT_EVAL_RUBRIC_DIMENSION_SCHEMA, AGENT_EVAL_RUBRIC_SCORE_SCHEMA),
  informationUnitCount: z.number().int().nonnegative(),
  paddingSentenceCount: z.number().int().nonnegative(),
});
export type iAgentEvalFieldScore = z.infer<typeof AGENT_EVAL_FIELD_SCORE_SCHEMA>;

export const AGENT_EVAL_TOOL_OUTCOME_SCHEMA = z.object({
  toolName: z.string().trim().min(1),
  outcome: z.enum(['completed', 'failed', 'no-op']),
});

export const AGENT_EVAL_USAGE_SCHEMA = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  costUsd: z.number().nonnegative(),
});

export const AGENT_EVAL_RUN_ARTIFACT_SCHEMA = z.object({
  artifactVersion: z.literal(AGENT_EVAL_CORPUS_VERSION),
  caseId: AGENT_EVAL_CASE_SCHEMA.shape.id,
  route: AGENT_EVAL_ROUTE_SCHEMA,
  pipelineRevision: z.string().trim().min(1),
  profileId: z.string().trim().min(1),
  modelId: z.string().trim().min(1),
  providerId: z.string().trim().min(1),
  seed: z.number().int().nullable(),
  startedAt: z.string().datetime(),
  latencyMs: z.number().int().nonnegative(),
  usage: AGENT_EVAL_USAGE_SCHEMA,
  assistantText: z.string(),
  proposedFields: z.partialRecord(CHARACTER_TEXT_FIELD_KEY_SCHEMA, z.string()),
  toolOutcomes: z.array(AGENT_EVAL_TOOL_OUTCOME_SCHEMA),
  fieldScores: z.array(AGENT_EVAL_FIELD_SCORE_SCHEMA),
  isPolicyEligible: z.boolean(),
  errorCategory: z.string().trim().min(1).nullable(),
});
export type iAgentEvalRunArtifact = z.infer<typeof AGENT_EVAL_RUN_ARTIFACT_SCHEMA>;

export const AGENT_EVAL_PAIRWISE_DECISION_SCHEMA = z.enum(['candidate-a', 'candidate-b', 'tie']);
export const AGENT_EVAL_PAIRWISE_REVIEW_SCHEMA = z.object({
  caseId: AGENT_EVAL_CASE_SCHEMA.shape.id,
  reviewerId: z.string().trim().min(1),
  presentationOrder: z.tuple([z.string().trim().min(1), z.string().trim().min(1)]),
  decision: AGENT_EVAL_PAIRWISE_DECISION_SCHEMA,
  dimensionDecisions: z.record(AGENT_EVAL_RUBRIC_DIMENSION_SCHEMA, AGENT_EVAL_PAIRWISE_DECISION_SCHEMA),
  notes: z.string().max(1_000),
});
export type iAgentEvalPairwiseReview = z.infer<typeof AGENT_EVAL_PAIRWISE_REVIEW_SCHEMA>;

export const AGENT_EVAL_ROUTE_BUDGET_SCHEMA = z.object({
  route: AGENT_EVAL_ROUTE_SCHEMA,
  p95LatencyMs: z.number().int().positive(),
  p95CostUsd: z.number().positive(),
  maximumCalls: z.number().int().positive(),
  maximumOutputTokens: z.number().int().positive(),
  sourceArtifactCount: z.number().int().positive(),
});
export type iAgentEvalRouteBudget = z.infer<typeof AGENT_EVAL_ROUTE_BUDGET_SCHEMA>;
