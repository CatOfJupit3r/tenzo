import { describe, expect, it } from 'vitest';

import { AGENT_ROLES } from './agent-role-contracts';
import type { iAgentRoleProfile } from './agent-role-contracts';
import { MODEL_CAPABILITIES } from './model-capabilities';
import { PROVIDER_KINDS } from './provider-health';
import { createProviderPolicyCatalogCache } from './provider-policy-catalog-cache';
import { PROVIDER_POLICY_FAILURE_REASONS, resolveProviderPolicy } from './provider-policy-resolver';
import type { iProviderPolicyCatalog } from './provider-policy-resolver';

const NOW = new Date('2026-08-21T00:00:00.000Z');

function createProfile(overrides: Partial<iAgentRoleProfile> = {}): iAgentRoleProfile {
  return {
    id: 'content-planner-test',
    role: AGENT_ROLES['content-planner'],
    providerKind: PROVIDER_KINDS.openrouter,
    modelId: 'test/unmoderated',
    allowedProviderSlugs: ['eligible-provider'],
    requiredCapabilities: [MODEL_CAPABILITIES['structured-output'], MODEL_CAPABILITIES['tool-calling']],
    temperature: 0.4,
    topP: 0.9,
    budget: {
      maximumCalls: 4,
      maximumInputTokens: 20_000,
      maximumOutputTokens: 4_000,
      maximumCostUsd: 0.5,
      maximumLatencyMs: 30_000,
    },
    maximumPromptPricePerMillionUsd: 2,
    maximumCompletionPricePerMillionUsd: 4,
    ...overrides,
  };
}

function createCatalog(
  endpointOverrides: Partial<iProviderPolicyCatalog['models'][number]['endpoints'][number]> = {},
  modelOverrides: Partial<iProviderPolicyCatalog['models'][number]> = {},
): iProviderPolicyCatalog {
  return {
    fetchedAt: NOW.toISOString(),
    models: [
      {
        modelId: 'test/unmoderated',
        isModerated: false,
        endpoints: [
          {
            providerSlug: 'eligible-provider',
            isZeroDataRetention: true,
            doesCollectData: false,
            isAvailable: true,
            supportedCapabilities: [MODEL_CAPABILITIES['structured-output'], MODEL_CAPABILITIES['tool-calling']],
            promptPricePerMillionUsd: 1,
            completionPricePerMillionUsd: 2,
            ...endpointOverrides,
          },
        ],
        ...modelOverrides,
      },
    ],
  };
}

describe('provider policy resolver', () => {
  it('pins an eligible OpenRouter endpoint set with immutable privacy routing', () => {
    const result = resolveProviderPolicy({ profile: createProfile(), catalog: createCatalog(), now: NOW });

    expect(result).toEqual({
      isEligible: true,
      isLocal: false,
      routing: {
        only: ['eligible-provider'],
        allowFallbacks: false,
        dataCollection: 'deny',
        zdr: true,
        requireParameters: true,
      },
      failures: [],
    });
  });

  it.each([
    {
      overrides: { isZeroDataRetention: false },
      reason: PROVIDER_POLICY_FAILURE_REASONS['endpoint-not-zdr'],
    },
    {
      overrides: { doesCollectData: true },
      reason: PROVIDER_POLICY_FAILURE_REASONS['endpoint-data-collecting'],
    },
    {
      overrides: { supportedCapabilities: [MODEL_CAPABILITIES['structured-output']] },
      reason: PROVIDER_POLICY_FAILURE_REASONS['capability-mismatch'],
    },
    {
      overrides: { isAvailable: false },
      reason: PROVIDER_POLICY_FAILURE_REASONS['endpoint-unavailable'],
    },
    {
      overrides: { completionPricePerMillionUsd: 5 },
      reason: PROVIDER_POLICY_FAILURE_REASONS['price-limit-exceeded'],
    },
  ])('fails closed for $reason endpoints', ({ overrides, reason }) => {
    const result = resolveProviderPolicy({ profile: createProfile(), catalog: createCatalog(overrides), now: NOW });

    expect(result.isEligible).toBe(false);
    expect(result.failures).toContainEqual(expect.objectContaining({ reason }));
  });

  it('rejects moderated models before considering their endpoints', () => {
    const result = resolveProviderPolicy({
      profile: createProfile(),
      catalog: createCatalog({}, { isModerated: true }),
      now: NOW,
    });

    expect(result).toEqual(
      expect.objectContaining({
        isEligible: false,
        failures: [{ reason: PROVIDER_POLICY_FAILURE_REASONS['model-moderated'], providerSlug: null }],
      }),
    );
  });

  it('rejects missing and stale catalogs instead of relaxing policy', () => {
    expect(resolveProviderPolicy({ profile: createProfile(), catalog: null, now: NOW }).failures).toEqual([
      { reason: PROVIDER_POLICY_FAILURE_REASONS['catalog-missing'], providerSlug: null },
    ]);
    expect(
      resolveProviderPolicy({
        profile: createProfile(),
        catalog: { ...createCatalog(), fetchedAt: '2026-08-20T23:00:00.000Z' },
        now: NOW,
      }).failures,
    ).toEqual([{ reason: PROVIDER_POLICY_FAILURE_REASONS['catalog-stale'], providerSlug: null }]);
  });

  it('identifies local KoboldCpp separately and still enforces role capabilities', () => {
    const localProfile = createProfile({
      providerKind: PROVIDER_KINDS.koboldcpp,
      allowedProviderSlugs: [],
      modelId: 'koboldcpp/local',
    });

    expect(
      resolveProviderPolicy({
        profile: localProfile,
        catalog: null,
        localCapabilities: [MODEL_CAPABILITIES['structured-output'], MODEL_CAPABILITIES['tool-calling']],
        now: NOW,
      }),
    ).toEqual({ isEligible: true, isLocal: true, routing: null, failures: [] });
    expect(resolveProviderPolicy({ profile: localProfile, catalog: null, localCapabilities: [], now: NOW })).toEqual(
      expect.objectContaining({
        isEligible: false,
        isLocal: true,
        failures: [{ reason: PROVIDER_POLICY_FAILURE_REASONS['capability-mismatch'], providerSlug: null }],
      }),
    );
  });

  it('keeps only bounded fresh policy metadata in the cache', () => {
    const cache = createProviderPolicyCatalogCache(1);
    cache.set('first', createCatalog());
    cache.set('second', { ...createCatalog(), models: [] });

    expect(cache.get('first', NOW)).toBeNull();
    expect(cache.get('second', NOW)).not.toBeNull();
    expect(cache.get('second', new Date('2026-08-21T01:00:00.000Z'))).toBeNull();
  });
});
