import { UserService } from '@~/features/user/user.service';

import { protectedProcedure, base, publicProcedure } from '../lib/orpc';

export const userRouter = base.user.router({
  getUserProfile: protectedProcedure.user.getUserProfile.handler(async ({ context }) => {
    const userId = context.session.user.id;
    return context.resolve(UserService).getUserProfile(userId);
  }),

  updateUserProfile: protectedProcedure.user.updateUserProfile.handler(async ({ context, input }) => {
    const userId = context.session.user.id;
    return context.resolve(UserService).updateUserProfile(userId, input.bio);
  }),

  updateUserBadge: protectedProcedure.user.updateUserBadge.handler(async ({ context, input }) => {
    const userId = context.session.user.id;
    const { badgeId } = input;
    return context.resolve(UserService).updateUserBadge(userId, badgeId);
  }),

  regeneratePublicCode: protectedProcedure.user.regeneratePublicCode.handler(async ({ context }) => {
    const userId = context.session.user.id;
    return context.resolve(UserService).regeneratePublicCode(userId);
  }),

  devToolsListAllUsers: publicProcedure.user.devToolsListAllUsers.handler(async ({ context }) =>
    context.resolve(UserService).listAllUsers(),
  ),
});
