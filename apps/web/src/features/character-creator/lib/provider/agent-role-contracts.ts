import { z } from 'zod';

import { MODEL_CAPABILITY_SCHEMA, MODEL_CAPABILITIES } from './model-capabilities';
import { PROVIDER_KIND_SCHEMA, PROVIDER_KINDS } from './provider-health';

export const AGENT_ROLE_SCHEMA = z.enum(['intent-router', 'brief-enricher', 'orchestrator', 'prose-worker', 'critic']);
export const AGENT_ROLES = AGENT_ROLE_SCHEMA.enum;
export type AgentRole = z.infer<typeof AGENT_ROLE_SCHEMA>;

export const AGENT_ROLE_CAPABILITY_REQUIREMENTS = {
  [AGENT_ROLES['intent-router']]: [MODEL_CAPABILITIES['structured-output']],
  [AGENT_ROLES['brief-enricher']]: [MODEL_CAPABILITIES['structured-output']],
  [AGENT_ROLES.orchestrator]: [MODEL_CAPABILITIES['structured-output'], MODEL_CAPABILITIES['tool-calling']],
  [AGENT_ROLES['prose-worker']]: [],
  [AGENT_ROLES.critic]: [MODEL_CAPABILITIES['structured-output']],
} satisfies Record<AgentRole, readonly z.infer<typeof MODEL_CAPABILITY_SCHEMA>[]>;

export const AGENT_ROLE_BUDGET_SCHEMA = z.object({
  maximumCalls: z.number().int().positive(),
  maximumInputTokens: z.number().int().positive(),
  maximumOutputTokens: z.number().int().positive(),
  maximumCostUsd: z.number().positive(),
  maximumLatencyMs: z.number().int().positive(),
});

export const AGENT_ROLE_PROFILE_SCHEMA = z
  .object({
    id: z.string().trim().min(1),
    role: AGENT_ROLE_SCHEMA,
    providerKind: PROVIDER_KIND_SCHEMA.refine(
      (kind) => kind === PROVIDER_KINDS.openrouter || kind === PROVIDER_KINDS.koboldcpp,
      'Role profiles support OpenRouter or local KoboldCpp only.',
    ),
    modelId: z.string().trim().min(1),
    allowedProviderSlugs: z.array(z.string().trim().min(1)).max(16),
    requiredCapabilities: z.array(MODEL_CAPABILITY_SCHEMA),
    temperature: z.number().min(0).max(2),
    topP: z.number().min(0).max(1),
    budget: AGENT_ROLE_BUDGET_SCHEMA,
    maximumPromptPricePerMillionUsd: z.number().nonnegative(),
    maximumCompletionPricePerMillionUsd: z.number().nonnegative(),
  })
  .superRefine((profile, context) => {
    const requiredCapabilities = AGENT_ROLE_CAPABILITY_REQUIREMENTS[profile.role];
    for (const capability of requiredCapabilities) {
      if (!profile.requiredCapabilities.includes(capability)) {
        context.addIssue({
          code: 'custom',
          path: ['requiredCapabilities'],
          message: `${profile.role} requires ${capability}.`,
        });
      }
    }

    if (profile.providerKind === PROVIDER_KINDS.koboldcpp && profile.allowedProviderSlugs.length > 0) {
      context.addIssue({
        code: 'custom',
        path: ['allowedProviderSlugs'],
        message: 'Local KoboldCpp profiles cannot declare remote provider slugs.',
      });
    }
  });

export type iAgentRoleBudget = z.infer<typeof AGENT_ROLE_BUDGET_SCHEMA>;
export type iAgentRoleProfile = z.infer<typeof AGENT_ROLE_PROFILE_SCHEMA>;
