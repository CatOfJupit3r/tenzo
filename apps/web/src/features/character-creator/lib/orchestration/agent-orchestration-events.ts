import { z } from 'zod';

import {
  AGENT_ORCHESTRATION_RECOVERY_SCHEMA,
  AGENT_PROGRESS_PHASE_SCHEMA,
  CHARACTER_BRIEF_CHOICE_SCHEMA,
  QUALITY_FINDING_SCHEMA,
} from './agent-orchestration-contracts';

export const AGENT_ORCHESTRATION_EVENT_NAMES = {
  phase: 'agent-orchestration.phase',
  assumptions: 'agent-orchestration.assumptions',
  quality: 'agent-orchestration.quality',
  recovery: 'agent-orchestration.recovery',
  metrics: 'agent-orchestration.metrics',
  proposal: 'agent-orchestration.proposal',
} as const;

export const AGENT_ORCHESTRATION_PHASE_EVENT_SCHEMA = z.object({
  runId: z.string().trim().min(1),
  phase: AGENT_PROGRESS_PHASE_SCHEMA,
});

export const AGENT_ORCHESTRATION_ASSUMPTIONS_EVENT_SCHEMA = z.object({
  runId: z.string().trim().min(1),
  assumptions: z.array(z.object({ id: z.string().trim().min(1), statement: z.string().trim().min(1) })),
  creativeChoices: z.array(CHARACTER_BRIEF_CHOICE_SCHEMA),
});

export const AGENT_ORCHESTRATION_QUALITY_EVENT_SCHEMA = z.object({
  runId: z.string().trim().min(1),
  findings: z.array(QUALITY_FINDING_SCHEMA),
});

export const AGENT_ORCHESTRATION_RECOVERY_EVENT_SCHEMA = z.object({
  runId: z.string().trim().min(1),
  recovery: AGENT_ORCHESTRATION_RECOVERY_SCHEMA,
  message: z.string(),
});

export const AGENT_ORCHESTRATION_METRICS_EVENT_SCHEMA = z.object({
  runId: z.string().trim().min(1),
  roleCallCount: z.number().int().nonnegative(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  costUsd: z.number().finite().nonnegative(),
  latencyMs: z.number().int().nonnegative(),
});
export type iAgentOrchestrationMetricsEvent = z.infer<typeof AGENT_ORCHESTRATION_METRICS_EVENT_SCHEMA>;

export const AGENT_ORCHESTRATION_PROPOSAL_EVENT_SCHEMA = z.object({
  runId: z.string().trim().min(1),
  proposalId: z.string().trim().min(1),
  toolCallId: z.string().trim().min(1),
  proposedFieldCount: z.number().int().nonnegative(),
});
