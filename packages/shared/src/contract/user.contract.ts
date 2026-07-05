import { oc } from '@orpc/contract';
import z from 'zod';

import { BadgeIdSchema } from '../constants/badges';
import { authProcedure } from './procedures';

const USER_PROFILE_SCHEMA = z.object({
  _id: z.string(),
  userId: z.string(),
  bio: z.string(),
  selectedBadge: BadgeIdSchema.optional().nullable(),
  publicCode: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

const getUserProfile = authProcedure
  .route({
    path: '/profile',
    method: 'GET',
    summary: "Get authenticated user's profile",
    description:
      "Retrieves the current user's custom profile data (bio and other custom fields not stored in Better Auth). Username and basic user info are managed through Better Auth and should be retrieved using the useMe hook. Returns the user profile object or throws USER_PROFILE_NOT_FOUND if profile doesn't exist.",
  })
  .output(USER_PROFILE_SCHEMA);

const updateUserProfile = authProcedure
  .route({
    path: '/profile',
    method: 'PUT',
    summary: "Update authenticated user's profile",
    description:
      "Updates the current user's profile bio (additional profile data not stored in Better Auth). Bio is optional and max 500 characters. Username and basic user info are managed through Better Auth and are read from useMe hook. Returns the updated profile object.",
  })
  .input(
    z.object({
      bio: z.string().min(0).max(500),
    }),
  )
  .output(USER_PROFILE_SCHEMA);

const updateUserBadge = authProcedure
  .route({
    path: '/badge',
    method: 'PUT',
    summary: 'Update user selected badge',
    description:
      "Updates the user's selected badge. Validates that the badge exists and checks if the user has unlocked the required achievement (if applicable). Returns the updated user profile with the new selected badge.",
  })
  .input(
    z.object({
      badgeId: BadgeIdSchema,
    }),
  )
  .output(USER_PROFILE_SCHEMA);

const regeneratePublicCode = authProcedure
  .route({
    path: '/regenerate-public-code',
    method: 'POST',
    summary: 'Regenerate user public code',
    description:
      'Generates a new unique public code for the authenticated user. The old public code will no longer be valid for sending invitations. Returns the updated user profile with the new public code.',
  })
  .input(z.object({}))
  .output(USER_PROFILE_SCHEMA);

const devToolsListAllUsers = oc
  .route({
    method: 'GET',
    path: '/dev-tools/users',
  })
  .output(
    z.array(
      z.object({
        _id: z.string(),
        name: z.string(),
      }),
    ),
  );

const userContract = oc.prefix('/users').router({
  getUserProfile,
  updateUserProfile,
  updateUserBadge,
  regeneratePublicCode,
  devToolsListAllUsers,
});

export default userContract;
