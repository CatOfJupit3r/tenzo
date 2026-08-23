import { z } from 'zod';

import { AGENT_ROLE_PROFILE_SCHEMA } from './agent-role-contracts';
import type { iAgentRoleProfile } from './agent-role-contracts';
import { MODEL_CAPABILITY_SCHEMA } from './model-capabilities';
import type { ModelCapability } from './model-capabilities';
import { PROVIDER_KINDS } from './provider-health';

export const PROVIDER_POLICY_CATALOG_TTL_MS = 5 * 60 * 1_000;

export const PROVIDER_POLICY_FAILURE_REASON_SCHEMA = z.enum([
  'catalog-missing',
  'catalog-stale',
  'model-missing',
  'model-moderated',
  'endpoint-not-zdr',
  'endpoint-data-collecting',
  'provider-not-allowed',
  'capability-mismatch',
  'price-limit-exceeded',
  'endpoint-unavailable',
]);
export const PROVIDER_POLICY_FAILURE_REASONS = PROVIDER_POLICY_FAILURE_REASON_SCHEMA.enum;
export type ProviderPolicyFailureReason = z.infer<typeof PROVIDER_POLICY_FAILURE_REASON_SCHEMA>;

export const PROVIDER_POLICY_ENDPOINT_SCHEMA = z.object({
  providerSlug: z.string().trim().min(1),
  isZeroDataRetention: z.boolean(),
  doesCollectData: z.boolean(),
  isAvailable: z.boolean(),
  supportedCapabilities: z.array(MODEL_CAPABILITY_SCHEMA),
  promptPricePerMillionUsd: z.number().nonnegative(),
  completionPricePerMillionUsd: z.number().nonnegative(),
});

export const PROVIDER_POLICY_MODEL_SCHEMA = z.object({
  modelId: z.string().trim().min(1),
  isModerated: z.boolean(),
  endpoints: z.array(PROVIDER_POLICY_ENDPOINT_SCHEMA),
});

export const PROVIDER_POLICY_CATALOG_SCHEMA = z.object({
  fetchedAt: z.string().datetime(),
  models: z.array(PROVIDER_POLICY_MODEL_SCHEMA),
});
export type iProviderPolicyCatalog = z.infer<typeof PROVIDER_POLICY_CATALOG_SCHEMA>;

export const PROVIDER_POLICY_ROUTING_SCHEMA = z.object({
  only: z.array(z.string().trim().min(1)).min(1),
  allowFallbacks: z.literal(false),
  dataCollection: z.literal('deny'),
  zdr: z.literal(true),
  requireParameters: z.boolean(),
});
export type iProviderPolicyRouting = z.infer<typeof PROVIDER_POLICY_ROUTING_SCHEMA>;

export interface iProviderPolicyFailure {
  reason: ProviderPolicyFailureReason;
  providerSlug: string | null;
}

export type ProviderPolicyResolution =
  | {
      isEligible: true;
      isLocal: boolean;
      routing: iProviderPolicyRouting | null;
      failures: [];
    }
  | {
      isEligible: false;
      isLocal: boolean;
      routing: null;
      failures: iProviderPolicyFailure[];
    };

export interface iResolveProviderPolicyOptions {
  profile: iAgentRoleProfile;
  catalog: iProviderPolicyCatalog | null;
  localCapabilities?: readonly ModelCapability[];
  now: Date;
}

function createFailure(
  reason: ProviderPolicyFailureReason,
  providerSlug: string | null = null,
): iProviderPolicyFailure {
  return { reason, providerSlug };
}

function getEndpointFailures(
  endpoint: z.infer<typeof PROVIDER_POLICY_ENDPOINT_SCHEMA>,
  profile: iAgentRoleProfile,
): iProviderPolicyFailure[] {
  const failures: iProviderPolicyFailure[] = [];
  const { providerSlug } = endpoint;

  if (!endpoint.isZeroDataRetention)
    failures.push(createFailure(PROVIDER_POLICY_FAILURE_REASONS['endpoint-not-zdr'], providerSlug));
  if (endpoint.doesCollectData)
    failures.push(createFailure(PROVIDER_POLICY_FAILURE_REASONS['endpoint-data-collecting'], providerSlug));
  if (!endpoint.isAvailable)
    failures.push(createFailure(PROVIDER_POLICY_FAILURE_REASONS['endpoint-unavailable'], providerSlug));
  if (profile.allowedProviderSlugs.length > 0 && !profile.allowedProviderSlugs.includes(providerSlug)) {
    failures.push(createFailure(PROVIDER_POLICY_FAILURE_REASONS['provider-not-allowed'], providerSlug));
  }
  if (!profile.requiredCapabilities.every((capability) => endpoint.supportedCapabilities.includes(capability))) {
    failures.push(createFailure(PROVIDER_POLICY_FAILURE_REASONS['capability-mismatch'], providerSlug));
  }
  if (
    endpoint.promptPricePerMillionUsd > profile.maximumPromptPricePerMillionUsd ||
    endpoint.completionPricePerMillionUsd > profile.maximumCompletionPricePerMillionUsd
  ) {
    failures.push(createFailure(PROVIDER_POLICY_FAILURE_REASONS['price-limit-exceeded'], providerSlug));
  }

  return failures;
}

export function resolveProviderPolicy(options: iResolveProviderPolicyOptions): ProviderPolicyResolution {
  const profile = AGENT_ROLE_PROFILE_SCHEMA.parse(options.profile);
  if (profile.providerKind === PROVIDER_KINDS.koboldcpp) {
    const hasRequiredCapabilities = profile.requiredCapabilities.every((capability) =>
      options.localCapabilities?.includes(capability),
    );
    if (!hasRequiredCapabilities) {
      return {
        isEligible: false,
        isLocal: true,
        routing: null,
        failures: [createFailure(PROVIDER_POLICY_FAILURE_REASONS['capability-mismatch'])],
      };
    }
    return { isEligible: true, isLocal: true, routing: null, failures: [] };
  }

  if (!options.catalog) {
    return {
      isEligible: false,
      isLocal: false,
      routing: null,
      failures: [createFailure(PROVIDER_POLICY_FAILURE_REASONS['catalog-missing'])],
    };
  }

  const catalog = PROVIDER_POLICY_CATALOG_SCHEMA.parse(options.catalog);
  if (options.now.getTime() - new Date(catalog.fetchedAt).getTime() > PROVIDER_POLICY_CATALOG_TTL_MS) {
    return {
      isEligible: false,
      isLocal: false,
      routing: null,
      failures: [createFailure(PROVIDER_POLICY_FAILURE_REASONS['catalog-stale'])],
    };
  }

  const model = catalog.models.find((candidate) => candidate.modelId === profile.modelId);
  if (!model) {
    return {
      isEligible: false,
      isLocal: false,
      routing: null,
      failures: [createFailure(PROVIDER_POLICY_FAILURE_REASONS['model-missing'])],
    };
  }
  if (model.isModerated) {
    return {
      isEligible: false,
      isLocal: false,
      routing: null,
      failures: [createFailure(PROVIDER_POLICY_FAILURE_REASONS['model-moderated'])],
    };
  }

  const evaluatedEndpoints = model.endpoints.map((endpoint) => ({
    endpoint,
    failures: getEndpointFailures(endpoint, profile),
  }));
  const eligibleEndpoints = evaluatedEndpoints
    .filter(({ failures: endpointFailures }) => endpointFailures.length === 0)
    .map(({ endpoint }) => endpoint);
  if (eligibleEndpoints.length === 0) {
    const failures = evaluatedEndpoints.flatMap(({ failures: endpointFailures }) => endpointFailures);
    return {
      isEligible: false,
      isLocal: false,
      routing: null,
      failures: failures.length > 0 ? failures : [createFailure(PROVIDER_POLICY_FAILURE_REASONS['endpoint-not-zdr'])],
    };
  }

  return {
    isEligible: true,
    isLocal: false,
    routing: PROVIDER_POLICY_ROUTING_SCHEMA.parse({
      only: [...new Set(eligibleEndpoints.map((endpoint) => endpoint.providerSlug))].sort(),
      allowFallbacks: false,
      dataCollection: 'deny',
      zdr: true,
      requireParameters: profile.requiredCapabilities.length > 0,
    }),
    failures: [],
  };
}
