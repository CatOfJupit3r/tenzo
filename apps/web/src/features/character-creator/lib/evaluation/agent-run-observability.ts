import { z } from 'zod';

import { loggerFactory } from '@~/lib/logging/logger';
import type { iLogger } from '@~/lib/logging/logging-contracts';

import { AGENT_ROLE_SCHEMA } from '../provider/agent-role-contracts';
import { PROVIDER_POLICY_FAILURE_REASON_SCHEMA } from '../provider/provider-policy-resolver';

export const AGENT_ROLE_CALL_OUTCOME_SCHEMA = z.enum(['completed', 'failed', 'cancelled']);
export const AGENT_ROLE_CALL_OUTCOMES = AGENT_ROLE_CALL_OUTCOME_SCHEMA.enum;

export const AGENT_ROLE_CALL_EVENT_SCHEMA = z.object({
  runId: z.string().trim().min(1),
  roleCallId: z.string().trim().min(1),
  role: AGENT_ROLE_SCHEMA,
  modelId: z.string().trim().min(1),
  providerId: z.string().trim().min(1),
  outcome: AGENT_ROLE_CALL_OUTCOME_SCHEMA,
  retryCount: z.number().int().nonnegative(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  costUsd: z.number().nonnegative(),
  latencyMs: z.number().int().nonnegative(),
  qualityFindingCount: z.number().int().nonnegative(),
  repairCount: z.number().int().nonnegative(),
  policyFailureReason: PROVIDER_POLICY_FAILURE_REASON_SCHEMA.nullable(),
});
export type iAgentRoleCallEvent = z.infer<typeof AGENT_ROLE_CALL_EVENT_SCHEMA>;

const AGENT_ROLE_CALL_LOGGER = loggerFactory.getLogger('character-assistant.agent-role');

export function logAgentRoleCall(event: iAgentRoleCallEvent, logger: iLogger = AGENT_ROLE_CALL_LOGGER) {
  const parsedEvent = AGENT_ROLE_CALL_EVENT_SCHEMA.parse(event);
  const context = { event: 'character-assistant-agent-role', ...parsedEvent };

  if (parsedEvent.outcome === AGENT_ROLE_CALL_OUTCOMES.failed) {
    logger.error('Agent role call', new Error(parsedEvent.policyFailureReason ?? 'Agent role call failed.'), context);
    return;
  }
  logger.info('Agent role call', context);
}
