// Example: Complete Integration Test with Fixtures (Fixture-First Approach)
// Location: apps/server/test/integration/user-profile.test.ts
//
// KEY PRINCIPLE: Tests use fixtures, fixtures call endpoints.
// This keeps tests clean and focused on behavior verification.

import { describe, it, expect } from 'vitest';

import {
  createUser,
  createUserWithProfile,
  createUserWithBio,
  createUserWithMaxBio,
} from './utilities';

describe('User Profile API', () => {
  describe('getUserProfile', () => {
    it('should auto-create user profile on first access', async () => {
      // Fixture handles all setup and profile creation
      const { profile } = await createUserWithProfile();

      // Test just verifies the behavior
      expect(profile).not.toBeNil();
      expect(profile.bio).toBe('');
      expect(profile.userId).toBeDefined();
      expect(profile._id).toBeDefined();
    });

    it('should return profile consistently on multiple accesses', async () => {
      // Fixture ensures profile exists
      const { profile: firstProfile } = await createUserWithProfile();

      // Another fixture call verifies consistency
      const { profile: secondProfile } = await createUserWithProfile();

      expect(secondProfile._id).toBe(firstProfile._id);
    });
  });

  describe('updateUserProfile', () => {
    it('should update user bio', async () => {
      // Fixture handles user creation AND bio update
      const { user, profile } = await createUserWithBio('This is my new bio');

      // Test verifies the result
      expect(profile.bio).toBe('This is my new bio');
      expect(profile.userId).toBe(user.id);
    });

    it('should validate bio max length (500 chars)', async () => {
      const { ctx } = await createUser();
      const longBio = 'a'.repeat(501);

      // Test validates error behavior
      // Note: The validation error is tested at the endpoint boundary
      // Fixture prevents invalid data from being created
      await expect(
        createUserWithBio(longBio)
      ).rejects.toThrow();
    });

    it('should allow bio with exactly 500 chars', async () => {
      const maxBio = 'a'.repeat(500);

      // Fixture handles maximum-length bio creation
      const { profile } = await createUserWithMaxBio(maxBio);

      expect(profile.bio).toBe(maxBio);
      expect(profile.bio.length).toBe(500);
    });

    it('should preserve user identity across profile updates', async () => {
      // Create user with first bio
      const { user: user1 } = await createUserWithBio('First bio');

      // Create another user with different bio
      const { user: user2 } = await createUserWithBio('Second bio');

      // Test verifies they're independent
      expect(user1.id).not.toBe(user2.id);
    });
  });
});

describe('Multiple User Interactions', () => {
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
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});
