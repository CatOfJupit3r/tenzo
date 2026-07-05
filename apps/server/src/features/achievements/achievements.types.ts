import type { UserAchievementId } from '@startername/shared/constants/achievements';

import type { Listener, ListenerPayload } from '../events/listener.class';

export interface iAchievementContext {
  unlock: <T extends UserAchievementId>(
    userId: string,
    achievementId: T,
    data?: Record<string, unknown>,
  ) => Promise<unknown>;
}

export interface iAchievementDefinition<TListener extends Listener<unknown> = Listener<unknown>> {
  id: UserAchievementId;
  listensTo: TListener[];
  handle: (payload: ListenerPayload<TListener>, context: iAchievementContext) => Promise<unknown>;
}
