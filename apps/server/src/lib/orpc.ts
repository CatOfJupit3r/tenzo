import { ORPCError, implement } from '@orpc/server';

import { CONTRACT } from '@startername/shared';

import type { Context } from '@~/loaders/hono.loader';

export const base = implement(CONTRACT)
  .$config({
    initialOutputValidationIndex: Number.NaN,
  })
  .$context<Context>();

export const publicProcedure = base;

const requireAuth = base.middleware(async ({ context, next }) => {
  if (!context.session) {
    throw new ORPCError('UNAUTHORIZED', { message: 'User is not authenticated' });
  }
  return next({
    context: {
      ...context,
      session: context.session,
    },
  });
});

export const protectedProcedure = publicProcedure.use(requireAuth);
