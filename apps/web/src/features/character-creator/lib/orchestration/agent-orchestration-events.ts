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
