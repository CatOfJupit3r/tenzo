import { oc } from '@orpc/contract';
import z from 'zod';

import { UserAchievementIdSchema } from '../constants/achievements';
import { authProcedure } from './procedures';

const USER_ACHIEVEMENT_META_SCHEMA = z.object({
  id: UserAchievementIdSchema,
  label: z.string(),
  description: z.string(),
  icon: z.string().optional(),
  badgeId: z.string().optional(),
});

const USER_ACHIEVEMENT_SCHEMA = z.object({
  id: UserAchievementIdSchema,
  unlockedAt: z.coerce.date(),
  data: z.record(z.string(), z.unknown()).optional(),
  meta: USER_ACHIEVEMENT_META_SCHEMA,
});

const listAchievements = oc
  .route({
    path: '/list',
    method: 'GET',
    summary: 'List all available achievements',
    description:
      'Returns metadata for all available achievements in the system. This includes both locked and unlocked achievements. Use getMyAchievements to see which achievements the authenticated user has unlocked.',
  })
  .output(z.array(USER_ACHIEVEMENT_META_SCHEMA));

const getMyAchievements = authProcedure
  .route({
    path: '/my',
    method: 'GET',
    summary: "Get authenticated user's unlocked achievements",
    description:
      'Returns all achievements that the authenticated user has unlocked, including unlock timestamps and achievement-specific data. Each achievement includes its metadata (label, description, icon, badge ID) for display purposes.',
  })
  .output(z.array(USER_ACHIEVEMENT_SCHEMA));

const achievementsContract = oc.prefix('/achievements').router({
  listAchievements,
  getMyAchievements,
});

export default achievementsContract;
