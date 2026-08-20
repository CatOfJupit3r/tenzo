import { z } from 'zod';

export const AGENT_QUALITY_PROFILE_SCHEMA = z.enum(['economy', 'balanced', 'quality']);
export const AGENT_QUALITY_PROFILES = AGENT_QUALITY_PROFILE_SCHEMA.enum;
export type AgentQualityProfile = z.infer<typeof AGENT_QUALITY_PROFILE_SCHEMA>;

export const AGENT_QUALITY_PROFILE_LABELS = {
  [AGENT_QUALITY_PROFILES.economy]: 'Economy',
  [AGENT_QUALITY_PROFILES.balanced]: 'Balanced',
  [AGENT_QUALITY_PROFILES.quality]: 'Quality',
} satisfies Record<AgentQualityProfile, string>;
