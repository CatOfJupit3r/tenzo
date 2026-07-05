import { AchievementsService } from '@~/features/achievements/achievements.service';

import { base, protectedProcedure, publicProcedure } from '../lib/orpc';

export const achievementsRouter = base.achievements.router({
  listAchievements: publicProcedure.achievements.listAchievements.handler(async ({ context }) =>
    context.resolve(AchievementsService).listAllAchievements(),
  ),

  getMyAchievements: protectedProcedure.achievements.getMyAchievements.handler(async ({ context }) => {
    const userId = context.session.user.id;
    return context.resolve(AchievementsService).getUserAchievements(userId);
  }),
});
