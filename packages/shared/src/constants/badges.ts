import { z } from 'zod';

export const BadgeIdSchema = z.enum(['BETA_TESTER', 'DEFAULT']);

export const BADGE_IDS = BadgeIdSchema.enum;

export type BadgeId = z.infer<typeof BadgeIdSchema>;

export interface iBadgeMeta {
  id: BadgeId;
  label: string;
  description: string;
  icon?: string;
  requiresAchievement?: string;
}
