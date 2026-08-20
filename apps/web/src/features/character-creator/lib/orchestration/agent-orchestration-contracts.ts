import { z } from 'zod';

import { CHARACTER_TEXT_FIELD_KEY_SCHEMA } from '../cards/card-schema';

export const AGENT_ROUTE_SCHEMA = z.enum(['advice', 'focused-edit', 'multi-field-edit', 'full-card']);
export const AGENT_ROUTES = AGENT_ROUTE_SCHEMA.enum;
export type AgentRoute = z.infer<typeof AGENT_ROUTE_SCHEMA>;

export const AGENT_ROUTE_DECISION_SCHEMA = z
  .object({
    route: AGENT_ROUTE_SCHEMA,
    answer: z.string().trim().max(2_000).nullable(),
  })
  .superRefine((decision, context) => {
    if (decision.route === AGENT_ROUTES.advice && !decision.answer) {
      context.addIssue({ code: 'custom', path: ['answer'], message: 'Advice routes require an answer.' });
    }
    if (decision.route !== AGENT_ROUTES.advice && decision.answer) {
      context.addIssue({
        code: 'custom',
        path: ['answer'],
        message: 'Drafting routes cannot include an advice answer.',
      });
    }
  });
export type iAgentRouteDecision = z.infer<typeof AGENT_ROUTE_DECISION_SCHEMA>;

export const AGENT_PROGRESS_PHASE_SCHEMA = z.enum([
  'understanding',
  'planning',
  'drafting',
  'reviewing',
  'repairing',
  'proposing',
  'completed',
  'failed',
  'cancelled',
]);
export const AGENT_PROGRESS_PHASES = AGENT_PROGRESS_PHASE_SCHEMA.enum;
export type AgentProgressPhase = z.infer<typeof AGENT_PROGRESS_PHASE_SCHEMA>;

export const AGENT_FACT_PROVENANCE_SCHEMA = z.enum(['user', 'card', 'reference-inspiration', 'model-assumption']);
export const AGENT_FACT_PROVENANCES = AGENT_FACT_PROVENANCE_SCHEMA.enum;
export type AgentFactProvenance = z.infer<typeof AGENT_FACT_PROVENANCE_SCHEMA>;

export const AGENT_GAP_IMPACT_SCHEMA = z.enum(['low', 'high']);
export const AGENT_GAP_IMPACTS = AGENT_GAP_IMPACT_SCHEMA.enum;
export type AgentGapImpact = z.infer<typeof AGENT_GAP_IMPACT_SCHEMA>;

export const CHARACTER_BRIEF_FACT_SCHEMA = z.object({
  id: z.string().trim().min(1),
  statement: z.string().trim().min(1).max(600),
  provenance: AGENT_FACT_PROVENANCE_SCHEMA,
  sourceId: z.string().trim().min(1).nullable(),
  impact: AGENT_GAP_IMPACT_SCHEMA,
  isReversibleDefault: z.boolean(),
});

export const CHARACTER_BRIEF_CHOICE_SCHEMA = z.object({
  id: z.string().trim().min(1),
  description: z.string().trim().min(1).max(400),
  impact: AGENT_GAP_IMPACT_SCHEMA,
  isSelected: z.boolean(),
});

export const CHARACTER_BRIEF_QUESTION_SCHEMA = z.object({
  id: z.string().trim().min(1),
  question: z.string().trim().min(1).max(300),
  impact: z.literal(AGENT_GAP_IMPACTS.high),
  options: z.array(z.string().trim().min(1).max(160)).max(3),
});

export const CHARACTER_BRIEF_FIELD_COVERAGE_SCHEMA = z.object({
  fieldKey: CHARACTER_TEXT_FIELD_KEY_SCHEMA,
  goals: z.array(z.string().trim().min(1).max(300)).min(1).max(8),
});

export const CHARACTER_BRIEF_SCHEMA = z.object({
  confirmedFacts: z.array(CHARACTER_BRIEF_FACT_SCHEMA),
  assumptions: z.array(CHARACTER_BRIEF_FACT_SCHEMA),
  creativeChoices: z.array(CHARACTER_BRIEF_CHOICE_SCHEMA),
  unresolvedQuestions: z.array(CHARACTER_BRIEF_QUESTION_SCHEMA).max(3),
  toneAndStyle: z.array(z.string().trim().min(1).max(200)).max(8),
  boundaries: z.array(z.string().trim().min(1).max(200)).max(8),
  requiredMotifs: z.array(z.string().trim().min(1).max(200)).max(8),
  avoidedMotifs: z.array(z.string().trim().min(1).max(200)).max(8),
  fieldCoverage: z.array(CHARACTER_BRIEF_FIELD_COVERAGE_SCHEMA).min(1),
});
export type iCharacterBrief = z.infer<typeof CHARACTER_BRIEF_SCHEMA>;

export const CHARACTER_CONTENT_DEPTH_SCHEMA = z.object({
  minimumInformationUnits: z.number().int().positive(),
  maximumOutputTokens: z.number().int().positive(),
});

export const CHARACTER_CONTENT_PLAN_ENTRY_SCHEMA = z.object({
  fieldKey: CHARACTER_TEXT_FIELD_KEY_SCHEMA,
  purpose: z.string().trim().min(1).max(400),
  ownedFactIds: z.array(z.string().trim().min(1)),
  allowedEchoFactIds: z.array(z.string().trim().min(1)),
  forbiddenRestatements: z.array(z.string().trim().min(1).max(300)),
  relevantContext: z.array(z.string().trim().min(1).max(600)),
  requiredMacros: z.array(z.string().trim().min(1)),
  strictTemplate: z.string().nullable(),
  depth: CHARACTER_CONTENT_DEPTH_SCHEMA,
  dependsOnFieldKeys: z.array(CHARACTER_TEXT_FIELD_KEY_SCHEMA),
});

export const CHARACTER_CONTENT_PLAN_SCHEMA = z.object({
  entries: z.array(CHARACTER_CONTENT_PLAN_ENTRY_SCHEMA).min(1),
  coupledFieldGroups: z.array(z.array(CHARACTER_TEXT_FIELD_KEY_SCHEMA).min(1).max(2)),
  styleBible: z.array(z.string().trim().min(1).max(300)).max(12),
});
export type iCharacterContentPlan = z.infer<typeof CHARACTER_CONTENT_PLAN_SCHEMA>;

export const PROSE_JOB_SCHEMA = z.object({
  id: z.string().trim().min(1),
  fieldKeys: z.array(CHARACTER_TEXT_FIELD_KEY_SCHEMA).min(1).max(2),
  purposes: z.array(z.string().trim().min(1)),
  ownedFacts: z.array(CHARACTER_BRIEF_FACT_SCHEMA),
  allowedEchoes: z.array(CHARACTER_BRIEF_FACT_SCHEMA),
  forbiddenRestatements: z.array(z.string().trim().min(1)),
  relevantContext: z.array(z.string().trim().min(1)),
  styleBible: z.array(z.string().trim().min(1)),
  requiredMacros: z.array(z.string().trim().min(1)),
  strictTemplates: z.partialRecord(CHARACTER_TEXT_FIELD_KEY_SCHEMA, z.string()),
  maximumOutputTokens: z.number().int().positive(),
  dependsOnJobIds: z.array(z.string().trim().min(1)),
});
export type iProseJob = z.infer<typeof PROSE_JOB_SCHEMA>;

export const PROSE_JOB_RESULT_SCHEMA = z.object({
  jobId: z.string().trim().min(1),
  fields: z.partialRecord(CHARACTER_TEXT_FIELD_KEY_SCHEMA, z.string().min(1)),
});
export type iProseJobResult = z.infer<typeof PROSE_JOB_RESULT_SCHEMA>;

export const QUALITY_FINDING_SEVERITY_SCHEMA = z.enum(['warning', 'error']);
export const QUALITY_FINDING_SEVERITIES = QUALITY_FINDING_SEVERITY_SCHEMA.enum;
export const QUALITY_FINDING_EVIDENCE_SCHEMA = z.enum([
  'deterministic',
  'fidelity',
  'coherence',
  'specificity',
  'voice',
  'semantic-repetition',
]);
export const QUALITY_FINDING_EVIDENCE = QUALITY_FINDING_EVIDENCE_SCHEMA.enum;

export const QUALITY_FINDING_SCHEMA = z.object({
  ruleId: z.string().trim().min(1),
  fieldKeys: z.array(CHARACTER_TEXT_FIELD_KEY_SCHEMA).min(1).max(2),
  severity: QUALITY_FINDING_SEVERITY_SCHEMA,
  evidence: QUALITY_FINDING_EVIDENCE_SCHEMA,
  explanation: z.string().trim().min(1).max(400),
  repairInstruction: z.string().trim().min(1).max(400),
  isResolved: z.boolean(),
});
export type iQualityFinding = z.infer<typeof QUALITY_FINDING_SCHEMA>;

export const AGENT_ORCHESTRATION_RECOVERY_SCHEMA = z.enum([
  'clarification-required',
  'profile-ineligible',
  'critic-unavailable',
  'repair-unavailable',
  'repair-budget-exhausted',
  'partial-draft',
  'cancelled',
]);
export const AGENT_ORCHESTRATION_RECOVERIES = AGENT_ORCHESTRATION_RECOVERY_SCHEMA.enum;

export const AGENT_ORCHESTRATION_RESULT_SCHEMA = z.object({
  runId: z.string().trim().min(1),
  route: AGENT_ROUTE_SCHEMA,
  phase: AGENT_PROGRESS_PHASE_SCHEMA,
  brief: CHARACTER_BRIEF_SCHEMA.nullable(),
  plan: CHARACTER_CONTENT_PLAN_SCHEMA.nullable(),
  drafts: z.partialRecord(CHARACTER_TEXT_FIELD_KEY_SCHEMA, z.string()),
  findings: z.array(QUALITY_FINDING_SCHEMA),
  answer: z.string(),
  recovery: AGENT_ORCHESTRATION_RECOVERY_SCHEMA.nullable(),
  proposalId: z.string().trim().min(1).nullable(),
});
export type iAgentOrchestrationResult = z.infer<typeof AGENT_ORCHESTRATION_RESULT_SCHEMA>;
