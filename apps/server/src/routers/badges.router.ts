import { BadgesService } from '@~/features/badges/badges.service';

import { base, publicProcedure } from '../lib/orpc';

export const badgesRouter = base.badges.router({
  listBadges: publicProcedure.badges.listBadges.handler(async ({ context }) =>
    context.resolve(BadgesService).listAllBadges(),
  ),
});
