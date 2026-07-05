import { USER_ACHIEVEMENTS } from '@startername/shared/constants/achievements';

import { BetaEventListener } from '@~/features/events/listeners/achievements.listeners';

import type { iAchievementContext, iAchievementDefinition } from '../achievements.types';

export const betaTesterAchievement: iAchievementDefinition<typeof BetaEventListener> = {
  id: USER_ACHIEVEMENTS.BETA_TESTER,
  listensTo: [BetaEventListener],
  async handle(payload, context: iAchievementContext) {
    await context.unlock(payload.userId, USER_ACHIEVEMENTS.BETA_TESTER, {});
  },
};
