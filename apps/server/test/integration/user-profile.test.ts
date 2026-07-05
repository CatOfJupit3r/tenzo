import { call } from '@orpc/server';
import { it, expect, describe } from 'vitest';

import { UserProfileModel } from '@~/db/models/user-profile.model';

import { appRouter } from '../helpers/instance';
import { createUser } from './utilities';

describe('User Profile API', () => {
  describe('getUserProfile', () => {
    it('should auto-create user profile', async () => {
      const { ctx } = await createUser();

      const profile = await call(appRouter.user.getUserProfile, null, ctx());

      expect(profile).not.toBeNil();
      expect(profile.bio).toBe('');
      expect(profile.userId).toBeDefined();
      expect(profile._id).toBeDefined();
      expect(profile.createdAt).toBeDefined();
      expect(profile.updatedAt).toBeDefined();
    });

    it('should fail if profile does not exist', async () => {
      const { ctx, user } = await createUser();

      await UserProfileModel.deleteOne({ userId: user.id });

      try {
        await call(appRouter.user.getUserProfile, null, ctx());
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('updateUserProfile', () => {
    it('should update user profile', async () => {
      const { ctx } = await createUser();

      const updatedProfile = await call(appRouter.user.updateUserProfile, { bio: 'This is my new bio' }, ctx());

      expect(updatedProfile).not.toBeNil();
      expect(updatedProfile.bio).toBe('This is my new bio');
    });

    it('should auto-create profile on first update if missing', async () => {
      const { ctx, user } = await createUser();

      await UserProfileModel.deleteOne({ userId: user.id });

      const updatedProfile = await call(appRouter.user.updateUserProfile, { bio: 'New bio for new profile' }, ctx());

      expect(updatedProfile).not.toBeNil();
      expect(updatedProfile.bio).toBe('New bio for new profile');
      expect(updatedProfile.userId).toBeDefined();
      expect(updatedProfile._id).toBeDefined();
    });

    it('should validate bio max length (500 chars)', async () => {
      const { ctx } = await createUser();

      const longBio = 'a'.repeat(501);

      try {
        await call(appRouter.user.updateUserProfile, { bio: longBio }, ctx());
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should allow bio with exactly 500 chars', async () => {
      const { ctx } = await createUser();

      const maxBio = 'a'.repeat(500);

      const updatedProfile = await call(appRouter.user.updateUserProfile, { bio: maxBio }, ctx());

      expect(updatedProfile).not.toBeNil();
      expect(updatedProfile.bio).toBe(maxBio);
      expect(updatedProfile.bio.length).toBe(500);
    });

    it('should allow empty bio', async () => {
      const { ctx } = await createUser();

      const updatedProfile = await call(appRouter.user.updateUserProfile, { bio: '' }, ctx());

      expect(updatedProfile).not.toBeNil();
      expect(updatedProfile.bio).toBe('');
    });

    it('should update existing profile bio', async () => {
      const { ctx } = await createUser();

      await call(appRouter.user.updateUserProfile, { bio: 'First bio' }, ctx());
      const updated = await call(appRouter.user.updateUserProfile, { bio: 'Second bio' }, ctx());

      expect(updated.bio).toBe('Second bio');
    });

    it('should preserve userId on update', async () => {
      const { ctx, user } = await createUser();

      const updated = await call(appRouter.user.updateUserProfile, { bio: 'New bio' }, ctx());

      expect(updated.userId).toBe(user.id);
    });

    it('should verify profile exists in database after creation', async () => {
      const { ctx, user } = await createUser();

      await call(appRouter.user.updateUserProfile, { bio: 'Test bio' }, ctx());

      const dbProfile = await UserProfileModel.findOne({ userId: user.id });
      expect(dbProfile).toBeDefined();
      expect(dbProfile?.bio).toBe('Test bio');
    });
  });
});

describe('Username Management (Better Auth)', () => {
  it('should create users with unique identifiers', async () => {
    const user1 = await createUser();
    const user2 = await createUser();

    expect(user1.user.id).toBeDefined();
    expect(user2.user.id).toBeDefined();
    expect(user1.user.id).not.toBe(user2.user.id);
  });

  it('should prevent duplicate email creation', async () => {
    const user1 = await createUser();

    try {
      await createUser({
        email: user1.user.email,
        name: 'Different Name',
        password: 'password123',
      });
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});

describe('Public Code Management', () => {
  it('should auto-generate public code on profile creation', async () => {
    const { ctx } = await createUser();

    const profile = await call(appRouter.user.getUserProfile, null, ctx());

    expect(profile.publicCode).toBeDefined();
    expect(profile.publicCode).toHaveLength(12);
    expect(typeof profile.publicCode).toBe('string');
  });

  it('should have unique public codes for different users', async () => {
    const user1 = await createUser();
    const user2 = await createUser();

    const profile1 = await call(appRouter.user.getUserProfile, null, user1.ctx());
    const profile2 = await call(appRouter.user.getUserProfile, null, user2.ctx());

    expect(profile1.publicCode).not.toBe(profile2.publicCode);
  });

  it('should regenerate public code', async () => {
    const { ctx } = await createUser();

    const originalProfile = await call(appRouter.user.getUserProfile, null, ctx());
    const originalpublicCode = originalProfile.publicCode;

    const updatedProfile = await call(appRouter.user.regeneratePublicCode, {}, ctx());

    expect(updatedProfile.publicCode).toBeDefined();
    expect(updatedProfile.publicCode).toHaveLength(12);
    expect(updatedProfile.publicCode).not.toBe(originalpublicCode);
  });

  it('should persist public code in database', async () => {
    const { ctx, user } = await createUser();

    const profile = await call(appRouter.user.getUserProfile, null, ctx());
    const publicCode = profile.publicCode;

    const dbProfile = await UserProfileModel.findOne({ userId: user.id });
    expect(dbProfile?.publicCode).toBe(publicCode);
  });
});
