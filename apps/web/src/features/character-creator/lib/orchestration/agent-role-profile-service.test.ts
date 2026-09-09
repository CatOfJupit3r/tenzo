import { describe, expect, it } from 'vitest';

import { AGENT_GENERATION_BUDGETS } from '../provider/agent-generation-budget';
import { AGENT_ROLES } from '../provider/agent-role-contracts';
import { MODEL_CAPABILITIES } from '../provider/model-capabilities';
import { PROVIDER_KINDS } from '../provider/provider-health';
import { createAgentRoleProfiles } from './agent-role-profile-service';

describe('agent role profile service', () => {
  it('builds replaceable same-model roles with immutable capability requirements', () => {
    const profiles = createAgentRoleProfiles({
      generationBudget: AGENT_GENERATION_BUDGETS.BALANCED,
      providerKind: PROVIDER_KINDS.OPENROUTER,
      modelId: 'test/model',
      allowedProviderSlug: 'test-provider',
      maximumProseOutputTokens: 2_000,
      proseTemperature: 0.8,
      topP: 0.9,
    });

    expect(Object.keys(profiles.record)).toHaveLength(Object.keys(AGENT_ROLES).length);
    expect(profiles.get(AGENT_ROLES.BRIEF_ENRICHER).requiredCapabilities).toContain(
      MODEL_CAPABILITIES.STRUCTURED_OUTPUT,
    );
    expect(profiles.get(AGENT_ROLES.CONTENT_PLANNER).budget.maximumOutputTokens).toBe(4_000);
    expect(profiles.get(AGENT_ROLES.PROSE_WORKER)).toMatchObject({
      modelId: 'test/model',
      allowedProviderSlugs: ['test-provider'],
      requiredCapabilities: [],
      temperature: 0.8,
    });
  });

  it('keeps local profiles separate from remote provider routing', () => {
    const profiles = createAgentRoleProfiles({
      generationBudget: AGENT_GENERATION_BUDGETS.ECONOMY,
      providerKind: PROVIDER_KINDS.KOBOLDCPP,
      modelId: 'koboldcpp/local',
      allowedProviderSlug: 'must-not-be-used',
      maximumProseOutputTokens: 1_000,
      proseTemperature: 1,
      topP: 1,
    });

    expect(profiles.get(AGENT_ROLES.CONTENT_PLANNER).allowedProviderSlugs).toEqual([]);
    expect(profiles.get(AGENT_ROLES.PROSE_WORKER).budget.maximumOutputTokens).toBe(750);
  });

  it('rejects unsupported provider kinds before a role can be executed', () => {
    expect(() =>
      createAgentRoleProfiles({
        generationBudget: AGENT_GENERATION_BUDGETS.EXPANDED,
        providerKind: PROVIDER_KINDS.UNKNOWN,
        modelId: 'unknown/model',
        allowedProviderSlug: '',
        maximumProseOutputTokens: 2_000,
        proseTemperature: 1,
        topP: 1,
      }),
    ).toThrow('OpenRouter or local KoboldCpp');
  });

  it('accepts replaceable per-role assignments for evaluation without branching on model IDs', () => {
    const profiles = createAgentRoleProfiles({
      generationBudget: AGENT_GENERATION_BUDGETS.EXPANDED,
      providerKind: PROVIDER_KINDS.OPENROUTER,
      modelId: 'default/model',
      allowedProviderSlug: 'default-provider',
      maximumProseOutputTokens: 2_000,
      proseTemperature: 1,
      topP: 1,
      roleAssignments: new Map([
        [AGENT_ROLES.PROSE_WORKER, { modelId: 'prose/model', allowedProviderSlug: 'prose-provider' }],
      ]),
    });

    expect(profiles.get(AGENT_ROLES.PROSE_WORKER)).toMatchObject({
      modelId: 'prose/model',
      allowedProviderSlugs: ['prose-provider'],
    });
    expect(profiles.get(AGENT_ROLES.CONTENT_PLANNER).modelId).toBe('default/model');
  });
});
