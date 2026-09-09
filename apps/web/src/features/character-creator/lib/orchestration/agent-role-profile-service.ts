import {
  AGENT_GENERATION_BUDGET_ENUM,
  AGENT_GENERATION_BUDGETS,
} from '@~/features/character-creator/lib/provider/agent-generation-budget';

import type { AgentGenerationBudget } from '../provider/agent-generation-budget';
import type { AgentRole } from '../provider/agent-role-contracts';
import {
  AGENT_ROLE_CAPABILITY_REQUIREMENTS,
  AGENT_ROLE_ENUM,
  AGENT_ROLE_PROFILE_SCHEMA,
  AGENT_ROLES,
} from '../provider/agent-role-contracts';
import type { ProviderKind } from '../provider/provider-health';
import { PROVIDER_KINDS } from '../provider/provider-health';

interface iAgentGenerationSafetyLimits {
  maximumInputTokens: number;
  maximumCostUsd: number;
  maximumLatencyMs: number;
  maximumPromptPricePerMillionUsd: number;
  maximumCompletionPricePerMillionUsd: number;
  structuredOutputTokens: number;
  proseOutputMultiplier: number;
}

const AGENT_GENERATION_SAFETY_LIMITS = AGENT_GENERATION_BUDGET_ENUM.derive<iAgentGenerationSafetyLimits>()(
  [
    AGENT_GENERATION_BUDGETS.ECONOMY,
    {
      maximumInputTokens: 16_000,
      maximumCostUsd: 0.04,
      maximumLatencyMs: 45_000,
      maximumPromptPricePerMillionUsd: 2,
      maximumCompletionPricePerMillionUsd: 4,
      structuredOutputTokens: 1_200,
      proseOutputMultiplier: 0.75,
    },
  ],
  [
    AGENT_GENERATION_BUDGETS.BALANCED,
    {
      maximumInputTokens: 32_000,
      maximumCostUsd: 0.12,
      maximumLatencyMs: 90_000,
      maximumPromptPricePerMillionUsd: 8,
      maximumCompletionPricePerMillionUsd: 16,
      structuredOutputTokens: 2_000,
      proseOutputMultiplier: 1,
    },
  ],
  [
    AGENT_GENERATION_BUDGETS.EXPANDED,
    {
      maximumInputTokens: 64_000,
      maximumCostUsd: 0.35,
      maximumLatencyMs: 180_000,
      maximumPromptPricePerMillionUsd: 20,
      maximumCompletionPricePerMillionUsd: 40,
      structuredOutputTokens: 3_000,
      proseOutputMultiplier: 1.5,
    },
  ],
);

export interface iCreateAgentRoleProfilesOptions {
  generationBudget: AgentGenerationBudget;
  providerKind: ProviderKind;
  modelId: string;
  allowedProviderSlug: string;
  maximumProseOutputTokens: number;
  proseTemperature: number;
  topP: number;
  roleAssignments?: ReadonlyMap<AgentRole, { modelId: string; allowedProviderSlug: string }>;
}

function getRoleOutputTokens(role: AgentRole, maximumProseOutputTokens: number, limits: iAgentGenerationSafetyLimits) {
  if (role === AGENT_ROLES.PROSE_WORKER) {
    return Math.max(1, Math.floor(maximumProseOutputTokens * limits.proseOutputMultiplier));
  }
  if (role === AGENT_ROLES.INTENT_ROUTER) return Math.min(400, limits.structuredOutputTokens);
  if (role === AGENT_ROLES.CONTENT_PLANNER) return limits.structuredOutputTokens * 2;
  return limits.structuredOutputTokens;
}

function getRoleTemperature(role: AgentRole, proseTemperature: number) {
  if (role === AGENT_ROLES.PROSE_WORKER) return proseTemperature;
  if (role === AGENT_ROLES.BRIEF_ENRICHER) return 0.4;
  return 0.1;
}

export function createAgentRoleProfiles(options: iCreateAgentRoleProfilesOptions) {
  if (options.providerKind !== PROVIDER_KINDS.OPENROUTER && options.providerKind !== PROVIDER_KINDS.KOBOLDCPP) {
    throw new Error('Agent orchestration requires OpenRouter or local KoboldCpp.');
  }
  const limits = AGENT_GENERATION_SAFETY_LIMITS.get(options.generationBudget);

  return AGENT_ROLE_ENUM.derive((role) =>
    AGENT_ROLE_PROFILE_SCHEMA.parse({
      id: `${options.generationBudget}-${role}`,
      role,
      providerKind: options.providerKind,
      modelId: options.roleAssignments?.get(role)?.modelId ?? options.modelId,
      allowedProviderSlugs:
        options.providerKind === PROVIDER_KINDS.OPENROUTER &&
        (options.roleAssignments?.get(role)?.allowedProviderSlug ?? options.allowedProviderSlug).trim()
          ? [(options.roleAssignments?.get(role)?.allowedProviderSlug ?? options.allowedProviderSlug).trim()]
          : [],
      requiredCapabilities: AGENT_ROLE_CAPABILITY_REQUIREMENTS.get(role),
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
  );
}
