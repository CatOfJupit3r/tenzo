import { describe, expect, it } from 'vitest';

import {
  PROVIDER_DATA_COLLECTION_DENY,
  PROVIDER_POLICY_FAILURE_REASONS,
  resolveProviderPolicy,
} from '@~/features/character-creator/lib/provider/provider-policy-resolver';

import type { iAgentRoleProfile } from './agent-role-contracts';
import { AGENT_ROLES } from './agent-role-contracts';
import { MODEL_CAPABILITIES } from './model-capabilities';
import { PROVIDER_KINDS } from './provider-health';
import { createProviderPolicyCatalogCache } from './provider-policy-catalog-cache';
import type { iProviderPolicyCatalog } from './provider-policy-resolver';

const NOW = new Date('2026-08-21T00:00:00.000Z');

function createProfile(overrides: Partial<iAgentRoleProfile> = {}): iAgentRoleProfile {
  return {
    id: 'content-planner-test',
    role: AGENT_ROLES.CONTENT_PLANNER,
    providerKind: PROVIDER_KINDS.OPENROUTER,
    modelId: 'test/unmoderated',
    allowedProviderSlugs: ['eligible-provider'],
    requiredCapabilities: [MODEL_CAPABILITIES.STRUCTURED_OUTPUT, MODEL_CAPABILITIES.TOOL_CALLING],
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
            supportedCapabilities: [MODEL_CAPABILITIES.STRUCTURED_OUTPUT, MODEL_CAPABILITIES.TOOL_CALLING],
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
        dataCollection: PROVIDER_DATA_COLLECTION_DENY,
        zdr: true,
        requireParameters: true,
      },
      failures: [],
    });
  });

  it.each([
    {
      overrides: { isZeroDataRetention: false },
      reason: PROVIDER_POLICY_FAILURE_REASONS.ENDPOINT_NOT_ZDR,
    },
    {
      overrides: { doesCollectData: true },
      reason: PROVIDER_POLICY_FAILURE_REASONS.ENDPOINT_DATA_COLLECTING,
    },
    {
      overrides: { supportedCapabilities: [MODEL_CAPABILITIES.STRUCTURED_OUTPUT] },
      reason: PROVIDER_POLICY_FAILURE_REASONS.CAPABILITY_MISMATCH,
    },
    {
      overrides: { isAvailable: false },
      reason: PROVIDER_POLICY_FAILURE_REASONS.ENDPOINT_UNAVAILABLE,
    },
    {
      overrides: { completionPricePerMillionUsd: 5 },
      reason: PROVIDER_POLICY_FAILURE_REASONS.PRICE_LIMIT_EXCEEDED,
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
        failures: [{ reason: PROVIDER_POLICY_FAILURE_REASONS.MODEL_MODERATED, providerSlug: null }],
      }),
    );
  });

  it('rejects missing and stale catalogs instead of relaxing policy', () => {
    expect(resolveProviderPolicy({ profile: createProfile(), catalog: null, now: NOW }).failures).toEqual([
      { reason: PROVIDER_POLICY_FAILURE_REASONS.CATALOG_MISSING, providerSlug: null },
    ]);
    expect(
      resolveProviderPolicy({
        profile: createProfile(),
        catalog: { ...createCatalog(), fetchedAt: '2026-08-20T23:00:00.000Z' },
        now: NOW,
      }).failures,
    ).toEqual([{ reason: PROVIDER_POLICY_FAILURE_REASONS.CATALOG_STALE, providerSlug: null }]);
  });

  it('identifies local KoboldCpp separately and still enforces role capabilities', () => {
    const localProfile = createProfile({
      providerKind: PROVIDER_KINDS.KOBOLDCPP,
      allowedProviderSlugs: [],
      modelId: 'koboldcpp/local',
    });

    expect(
      resolveProviderPolicy({
        profile: localProfile,
        catalog: null,
        localCapabilities: [MODEL_CAPABILITIES.STRUCTURED_OUTPUT, MODEL_CAPABILITIES.TOOL_CALLING],
        now: NOW,
      }),
    ).toEqual({ isEligible: true, isLocal: true, routing: null, failures: [] });
    expect(resolveProviderPolicy({ profile: localProfile, catalog: null, localCapabilities: [], now: NOW })).toEqual(
      expect.objectContaining({
        isEligible: false,
        isLocal: true,
        failures: [{ reason: PROVIDER_POLICY_FAILURE_REASONS.CAPABILITY_MISMATCH, providerSlug: null }],
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
