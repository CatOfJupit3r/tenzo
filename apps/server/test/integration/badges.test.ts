import { call } from '@orpc/server';
import { it, expect, describe, beforeEach } from 'vitest';

import { USER_ACHIEVEMENTS } from '@startername/shared';
import { BADGE_IDS } from '@startername/shared/constants/badges';

import { UserAchievementModel } from '@~/db/models/user-achievements.model';
import { UserProfileModel } from '@~/db/models/user-profile.model';

import { appRouter } from '../helpers/instance';
import { createUser } from './utilities';

describe('Badge Selection API', () => {
  describe('updateUserBadge', () => {
    it('should allow selecting DEFAULT badge without achievement', async () => {
      const { ctx, user } = await createUser();

      const updatedProfile = await call(appRouter.user.updateUserBadge, { badgeId: BADGE_IDS.DEFAULT }, ctx());

      expect(updatedProfile).not.toBeNil();
      expect(updatedProfile.selectedBadge).toBe(BADGE_IDS.DEFAULT);
      expect(updatedProfile.userId).toBe(user.id);
    });

    it('should reject badge selection when user lacks required achievement', async () => {
      const { ctx } = await createUser();

      try {
        await call(appRouter.user.updateUserBadge, { badgeId: BADGE_IDS.BETA_TESTER }, ctx());
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error).toBeDefined();
        expect(error.message).toContain('You do not have the required achievement to use this badge');
      }
    });

    it('should allow badge selection when user has required achievement', async () => {
      const { ctx, user } = await createUser();

      await Promise.all(
        Object.keys(USER_ACHIEVEMENTS).map(async (achievementId) =>
          UserAchievementModel.create({
            userId: user.id,
            achievementId: achievementId,
            unlockedAt: new Date(),
          }),
        ),
      );

      await Promise.all(
        Object.keys(BADGE_IDS).map(async (key) => {
          const badgeId = BADGE_IDS[key as keyof typeof BADGE_IDS];

          const updatedProfile = await call(appRouter.user.updateUserBadge, { badgeId }, ctx());
          expect(updatedProfile).not.toBeNil();
          expect(updatedProfile.selectedBadge).toBe(badgeId);
        }),
      );
    });

    it('should auto-create profile on first badge selection if missing', async () => {
      const { ctx, user } = await createUser();

      await UserProfileModel.deleteOne({ userId: user.id });

      const updatedProfile = await call(appRouter.user.updateUserBadge, { badgeId: BADGE_IDS.DEFAULT }, ctx());

      expect(updatedProfile).not.toBeNil();
      expect(updatedProfile.selectedBadge).toBe(BADGE_IDS.DEFAULT);
      expect(updatedProfile.userId).toBe(user.id);
      expect(updatedProfile._id).toBeDefined();
    });

    it('should preserve bio when updating badge', async () => {
      const { ctx } = await createUser();

      await call(appRouter.user.updateUserProfile, { bio: 'My cool bio' }, ctx());

      const updatedProfile = await call(appRouter.user.updateUserBadge, { badgeId: BADGE_IDS.DEFAULT }, ctx());

      expect(updatedProfile.bio).toBe('My cool bio');
      expect(updatedProfile.selectedBadge).toBe(BADGE_IDS.DEFAULT);
    });

    it('should verify badge persists in database after selection', async () => {
      const { ctx, user } = await createUser();

      await call(appRouter.user.updateUserBadge, { badgeId: BADGE_IDS.DEFAULT }, ctx());

      const dbProfile = await UserProfileModel.findOne({ userId: user.id });
      expect(dbProfile).toBeDefined();
      expect(dbProfile?.selectedBadge).toBe(BADGE_IDS.DEFAULT);
    });

    it('should include selectedBadge in getUserProfile response', async () => {
      const { ctx } = await createUser();

      await call(appRouter.user.updateUserBadge, { badgeId: BADGE_IDS.DEFAULT }, ctx());

      const profile = await call(appRouter.user.getUserProfile, null, ctx());

      expect(profile).not.toBeNil();
      expect(profile.selectedBadge).toBe(BADGE_IDS.DEFAULT);
    });

    it('should return null for selectedBadge when not set', async () => {
      const { ctx } = await createUser();

      const profile = await call(appRouter.user.getUserProfile, null, ctx());

      expect(profile).not.toBeNil();
      expect(profile.selectedBadge).toBeNull();
    });
  });
});
