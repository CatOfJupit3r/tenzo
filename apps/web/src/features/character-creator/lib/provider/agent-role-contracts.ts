import { em } from 'enumwaii';
import { z } from 'zod';

import { MODEL_CAPABILITIES, MODEL_CAPABILITY_SCHEMA } from './model-capabilities';
import { PROVIDER_KIND_SCHEMA, PROVIDER_KINDS } from './provider-health';

export const AGENT_ROLE_ENUM = em(['INTENT_ROUTER', 'BRIEF_ENRICHER', 'CONTENT_PLANNER', 'PROSE_WORKER']);
export const AGENT_ROLES = AGENT_ROLE_ENUM.enum;
export const AGENT_ROLE_SCHEMA = z.enum(AGENT_ROLES);

export type AgentRole = z.infer<typeof AGENT_ROLE_SCHEMA>;

export const AGENT_ROLE_CAPABILITY_REQUIREMENTS = AGENT_ROLE_ENUM.derive<
  readonly z.infer<typeof MODEL_CAPABILITY_SCHEMA>[]
>()(
  [AGENT_ROLES.INTENT_ROUTER, [MODEL_CAPABILITIES.STRUCTURED_OUTPUT]],
  [AGENT_ROLES.BRIEF_ENRICHER, [MODEL_CAPABILITIES.STRUCTURED_OUTPUT]],
  [AGENT_ROLES.CONTENT_PLANNER, [MODEL_CAPABILITIES.STRUCTURED_OUTPUT]],
  [AGENT_ROLES.PROSE_WORKER, []],
);

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
      (kind) => kind === PROVIDER_KINDS.OPENROUTER || kind === PROVIDER_KINDS.KOBOLDCPP,
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
    const requiredCapabilities = AGENT_ROLE_CAPABILITY_REQUIREMENTS.get(profile.role);
    for (const capability of requiredCapabilities) {
      if (!profile.requiredCapabilities.includes(capability)) {
        context.addIssue({
          code: 'custom',
          path: ['requiredCapabilities'],
          message: `${profile.role} requires ${capability}.`,
        });
      }
    }

    if (profile.providerKind === PROVIDER_KINDS.KOBOLDCPP && profile.allowedProviderSlugs.length > 0) {
      context.addIssue({
        code: 'custom',
        path: ['allowedProviderSlugs'],
        message: 'Local KoboldCpp profiles cannot declare remote provider slugs.',
      });
    }
  });

export type iAgentRoleBudget = z.infer<typeof AGENT_ROLE_BUDGET_SCHEMA>;
export type iAgentRoleProfile = z.infer<typeof AGENT_ROLE_PROFILE_SCHEMA>;
