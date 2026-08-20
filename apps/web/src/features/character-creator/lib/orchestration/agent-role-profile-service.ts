import { AGENT_QUALITY_PROFILES } from '../provider/agent-quality-profile';
import type { AgentQualityProfile } from '../provider/agent-quality-profile';
import {
  AGENT_ROLES,
  AGENT_ROLE_CAPABILITY_REQUIREMENTS,
  AGENT_ROLE_PROFILE_SCHEMA,
} from '../provider/agent-role-contracts';
import type { AgentRole, iAgentRoleProfile } from '../provider/agent-role-contracts';
import { PROVIDER_KINDS } from '../provider/provider-health';
import type { ProviderKind } from '../provider/provider-health';

interface iAgentQualitySafetyLimits {
  maximumInputTokens: number;
  maximumCostUsd: number;
  maximumLatencyMs: number;
  maximumPromptPricePerMillionUsd: number;
  maximumCompletionPricePerMillionUsd: number;
  structuredOutputTokens: number;
  proseOutputMultiplier: number;
}

const AGENT_QUALITY_SAFETY_LIMITS = {
  [AGENT_QUALITY_PROFILES.economy]: {
    maximumInputTokens: 16_000,
    maximumCostUsd: 0.04,
    maximumLatencyMs: 45_000,
    maximumPromptPricePerMillionUsd: 2,
    maximumCompletionPricePerMillionUsd: 4,
    structuredOutputTokens: 1_200,
    proseOutputMultiplier: 0.75,
  },
  [AGENT_QUALITY_PROFILES.balanced]: {
    maximumInputTokens: 32_000,
    maximumCostUsd: 0.12,
    maximumLatencyMs: 90_000,
    maximumPromptPricePerMillionUsd: 8,
    maximumCompletionPricePerMillionUsd: 16,
    structuredOutputTokens: 2_000,
    proseOutputMultiplier: 1,
  },
  [AGENT_QUALITY_PROFILES.quality]: {
    maximumInputTokens: 64_000,
    maximumCostUsd: 0.35,
    maximumLatencyMs: 180_000,
    maximumPromptPricePerMillionUsd: 20,
    maximumCompletionPricePerMillionUsd: 40,
    structuredOutputTokens: 3_000,
    proseOutputMultiplier: 1.5,
  },
} satisfies Record<AgentQualityProfile, iAgentQualitySafetyLimits>;

export interface iCreateAgentRoleProfilesOptions {
  qualityProfile: AgentQualityProfile;
  providerKind: ProviderKind;
  modelId: string;
  allowedProviderSlug: string;
  maximumProseOutputTokens: number;
  proseTemperature: number;
  topP: number;
  roleAssignments?: Partial<Record<AgentRole, { modelId: string; allowedProviderSlug: string }>>;
}

function getRoleOutputTokens(role: AgentRole, maximumProseOutputTokens: number, limits: iAgentQualitySafetyLimits) {
  if (role === AGENT_ROLES['prose-worker']) {
    return Math.max(1, Math.floor(maximumProseOutputTokens * limits.proseOutputMultiplier));
  }
  if (role === AGENT_ROLES['intent-router']) return Math.min(400, limits.structuredOutputTokens);
  if (role === AGENT_ROLES.critic) return Math.min(1_200, limits.structuredOutputTokens);
  return limits.structuredOutputTokens;
}

function getRoleTemperature(role: AgentRole, proseTemperature: number) {
  if (role === AGENT_ROLES['prose-worker']) return proseTemperature;
  if (role === AGENT_ROLES['brief-enricher']) return 0.4;
  return 0.1;
}

export function createAgentRoleProfiles(
  options: iCreateAgentRoleProfilesOptions,
): Record<AgentRole, iAgentRoleProfile> {
  if (options.providerKind !== PROVIDER_KINDS.openrouter && options.providerKind !== PROVIDER_KINDS.koboldcpp) {
    throw new Error('Agent orchestration requires OpenRouter or local KoboldCpp.');
  }
  const limits = AGENT_QUALITY_SAFETY_LIMITS[options.qualityProfile];

  return Object.fromEntries(
    Object.values(AGENT_ROLES).map((role) => [
      role,
      AGENT_ROLE_PROFILE_SCHEMA.parse({
        id: `${options.qualityProfile}-${role}`,
        role,
        providerKind: options.providerKind,
        modelId: options.roleAssignments?.[role]?.modelId ?? options.modelId,
        allowedProviderSlugs:
          options.providerKind === PROVIDER_KINDS.openrouter &&
          (options.roleAssignments?.[role]?.allowedProviderSlug ?? options.allowedProviderSlug).trim()
            ? [(options.roleAssignments?.[role]?.allowedProviderSlug ?? options.allowedProviderSlug).trim()]
            : [],
        requiredCapabilities: AGENT_ROLE_CAPABILITY_REQUIREMENTS[role],
        temperature: getRoleTemperature(role, options.proseTemperature),
        topP: options.topP,
        budget: {
          maximumCalls: 1,
          maximumInputTokens: limits.maximumInputTokens,
          maximumOutputTokens: getRoleOutputTokens(role, options.maximumProseOutputTokens, limits),
          maximumCostUsd: limits.maximumCostUsd,
          maximumLatencyMs: limits.maximumLatencyMs,
        },
        maximumPromptPricePerMillionUsd: limits.maximumPromptPricePerMillionUsd,
        maximumCompletionPricePerMillionUsd: limits.maximumCompletionPricePerMillionUsd,
      }),
    ]),
  ) as Record<AgentRole, iAgentRoleProfile>;
}
