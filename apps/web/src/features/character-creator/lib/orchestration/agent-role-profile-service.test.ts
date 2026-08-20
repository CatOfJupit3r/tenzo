import { describe, expect, it } from 'vitest';

import { AGENT_QUALITY_PROFILES } from '../provider/agent-quality-profile';
import { AGENT_ROLES } from '../provider/agent-role-contracts';
import { MODEL_CAPABILITIES } from '../provider/model-capabilities';
import { PROVIDER_KINDS } from '../provider/provider-health';
import { createAgentRoleProfiles } from './agent-role-profile-service';

describe('agent role profile service', () => {
  it('builds replaceable same-model roles with immutable capability requirements', () => {
    const profiles = createAgentRoleProfiles({
      qualityProfile: AGENT_QUALITY_PROFILES.balanced,
      providerKind: PROVIDER_KINDS.openrouter,
      modelId: 'test/model',
      allowedProviderSlug: 'test-provider',
      maximumProseOutputTokens: 2_000,
      proseTemperature: 0.8,
      topP: 0.9,
    });

    expect(Object.keys(profiles)).toHaveLength(Object.keys(AGENT_ROLES).length);
    expect(profiles[AGENT_ROLES['brief-enricher']].requiredCapabilities).toContain(
      MODEL_CAPABILITIES['structured-output'],
    );
    expect(profiles[AGENT_ROLES['prose-worker']]).toMatchObject({
      modelId: 'test/model',
      allowedProviderSlugs: ['test-provider'],
      requiredCapabilities: [],
      temperature: 0.8,
    });
  });

  it('keeps local profiles separate from remote provider routing', () => {
    const profiles = createAgentRoleProfiles({
      qualityProfile: AGENT_QUALITY_PROFILES.economy,
      providerKind: PROVIDER_KINDS.koboldcpp,
      modelId: 'koboldcpp/local',
      allowedProviderSlug: 'must-not-be-used',
      maximumProseOutputTokens: 1_000,
      proseTemperature: 1,
      topP: 1,
    });

    expect(profiles[AGENT_ROLES.critic].allowedProviderSlugs).toEqual([]);
    expect(profiles[AGENT_ROLES['prose-worker']].budget.maximumOutputTokens).toBe(750);
  });

  it('rejects unsupported provider kinds before a role can be executed', () => {
    expect(() =>
      createAgentRoleProfiles({
        qualityProfile: AGENT_QUALITY_PROFILES.quality,
        providerKind: PROVIDER_KINDS.unknown,
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
      qualityProfile: AGENT_QUALITY_PROFILES.quality,
      providerKind: PROVIDER_KINDS.openrouter,
      modelId: 'default/model',
      allowedProviderSlug: 'default-provider',
      maximumProseOutputTokens: 2_000,
      proseTemperature: 1,
      topP: 1,
      roleAssignments: {
        [AGENT_ROLES['prose-worker']]: { modelId: 'prose/model', allowedProviderSlug: 'prose-provider' },
      },
    });

    expect(profiles[AGENT_ROLES['prose-worker']]).toMatchObject({
      modelId: 'prose/model',
      allowedProviderSlugs: ['prose-provider'],
    });
    expect(profiles[AGENT_ROLES.critic].modelId).toBe('default/model');
  });
});
