import { User, Session } from '@~/db/models/auth.model';
import { base, publicProcedure } from '@~/lib/orpc';

export const indexRouter = base.index.router({
  healthCheck: publicProcedure.index.healthCheck.handler(async () => ({ status: 'OK' })),

  metrics: publicProcedure.index.metrics.handler(async () => {
    const now = new Date();

    const [totalUsers, activeSessions] = await Promise.all([
      User.countDocuments(),
      Session.countDocuments({ expiresAt: { $gt: now } }),
    ]);

    return {
      totalUsers,
      activeSessions,
    };
  }),
});
