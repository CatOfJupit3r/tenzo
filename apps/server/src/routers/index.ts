import { base } from '../lib/orpc';
import { achievementsRouter } from './achievements.router';
import { badgesRouter } from './badges.router';
import { indexRouter } from './index.router';
import { userRouter } from './user.router';

export const appRouter = base.router({
  user: userRouter,
  index: indexRouter,
  achievements: achievementsRouter,
  badges: badgesRouter,
});

export type AppRouter = typeof appRouter;
