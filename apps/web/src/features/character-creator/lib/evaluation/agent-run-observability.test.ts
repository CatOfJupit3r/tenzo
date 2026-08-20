import { describe, expect, it } from 'vitest';

import type { iLogger } from '@~/lib/logging/logging-contracts';

import { AGENT_ROLES } from '../provider/agent-role-contracts';
import { PROVIDER_POLICY_FAILURE_REASONS } from '../provider/provider-policy-resolver';
import { AGENT_ROLE_CALL_OUTCOMES, logAgentRoleCall } from './agent-run-observability';

describe('agent role observability', () => {
  it('records correlated operational metadata without accepting content fields', () => {
    const logs: Record<string, unknown>[] = [];
    const logger: iLogger = {
      debug: () => undefined,
      info: (_message, context) => logs.push(context ?? {}),
      warn: () => undefined,
      error: (_message, _error, context) => logs.push(context ?? {}),
      fatal: () => undefined,
      child: () => logger,
    };

    logAgentRoleCall(
      {
        runId: 'run-1',
        roleCallId: 'call-1',
        role: AGENT_ROLES.critic,
        modelId: 'model-1',
        providerId: 'provider-1',
        outcome: AGENT_ROLE_CALL_OUTCOMES.failed,
        retryCount: 1,
        inputTokens: 100,
        outputTokens: 20,
        costUsd: 0.01,
        latencyMs: 500,
        qualityFindingCount: 2,
        repairCount: 0,
        policyFailureReason: PROVIDER_POLICY_FAILURE_REASONS['model-moderated'],
      },
      logger,
    );

    expect(logs).toEqual([
      expect.objectContaining({
        runId: 'run-1',
        role: AGENT_ROLES.critic,
        policyFailureReason: PROVIDER_POLICY_FAILURE_REASONS['model-moderated'],
      }),
    ]);
    expect(JSON.stringify(logs)).not.toContain('prompt');
    expect(JSON.stringify(logs)).not.toContain('content');
  });
});
