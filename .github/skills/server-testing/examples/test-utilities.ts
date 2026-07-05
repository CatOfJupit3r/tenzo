// Example: Creating Test Utilities
// Location: apps/server/test/integration/utilities.ts

import { auth } from '../helpers/instance';

type UserData = NonNullable<
  Prettify<Parameters<typeof auth.api.signUpEmail>[0]>
>['body'];

// ============================================================================
// User Creation Utilities
// ============================================================================

/**
 * Creates a random user with unique email and name
 */
export function createRandomUser() {
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return {
    email: `userapi-${randomSuffix}@example.com`,
    name: `Test User ${randomSuffix}`,
    password: 'password123',
  } satisfies UserData;
}

/**
 * Creates an authenticated user with session
 * 
 * @param newUser - User data (defaults to random user)
 * @returns Object with ctx, user, session, and cookie
 * 
 * @example
 * ```typescript
 * // Create random user
 * const { ctx, user } = await createUser();
 * 
 * // Create specific user
 * const { ctx, user } = await createUser({
 *   email: 'test@example.com',
 *   name: 'Test User',
 *   password: 'password123',
 * });
 * ```
 */
export async function createUser(newUser: UserData = createRandomUser()) {
  const {
    headers,
    response: { user },
  } = await auth.api.signUpEmail({
    body: newUser,
    returnHeaders: true,
  });

  const cookie = headers.getSetCookie()[0];

  const getSession = await auth.api.getSession({
    headers: {
      cookie,
    },
  });

  if (!getSession?.session) throw new Error('Failed to create user session');
  const { session } = getSession;

  return {
    cookie,
    session,
    user,
    ctx: () => ({
      context: {
        session: {
          user,
          session,
        },
      },
    }),
  };
}

// ============================================================================
// Example: Specialized User Creation
// ============================================================================

/**
 * Creates a user with admin privileges
 */
export async function createAdminUser() {
  const user = await createUser({
    email: `admin-${Date.now()}@example.com`,
    name: 'Admin User',
    password: 'admin123',
  });

  // Grant admin role (example - adjust to your model)
  // await UserModel.findByIdAndUpdate(user.user.id, { role: 'ADMIN' });

  return user;
}

/**
 * Creates a user with specific achievements via API
 * 
 * NOTE: Fixture calls endpoints to ensure full API testing
 */
export async function createUserWithAchievements(achievementIds: string[]) {
  const user = await createUser();

  // Fixture grants achievements via API endpoints
  // await Promise.all(
  //   achievementIds.map((id) =>
  //     call(appRouter.achievements.grant, { achievementId: id }, user.ctx())
  //   )
  // );

  return user;
}

/**
 * Creates a user with a profile via API
 * 
 * NOTE: Fixture calls endpoint to create profile
 */
export async function createUserWithProfile() {
  const user = await createUser();

  // Fixture calls endpoint to get/create profile
  // const profile = await call(appRouter.user.getUserProfile, null, user.ctx());

  return {
    ...user,
    profile: user, // In real implementation, return actual profile object
  };
}

/**
 * Creates a user and updates their bio via API
 * 
 * NOTE: Fixture handles profile creation AND bio update
 */
export async function createUserWithBio(bio: string) {
  const user = await createUser();

  // Fixture calls endpoint to update profile
  // const profile = await call(
  //   appRouter.user.updateUserProfile,
  //   { bio },
  //   user.ctx()
  // );

  return {
    ...user,
    profile: { bio }, // In real implementation, return actual profile
  };
}

/**
 * Creates a user with maximum-length bio via API
 * 
 * NOTE: Fixture encapsulates the constraint
 */
export async function createUserWithMaxBio(bio: string) {
  if (bio.length > 500) {
    throw new Error('Bio exceeds maximum length of 500 characters');
  }

  return createUserWithBio(bio);
}

// ============================================================================
// Example: Data Factory Functions
// ============================================================================

/**
 * Creates test challenge data with optional overrides
 */
export function createChallengeData(overrides = {}) {
  return {
    title: 'Test Challenge',
    description: 'Test Description',
    difficulty: 'MEDIUM',
    points: 100,
    ...overrides,
  };
}

/**
 * Creates test profile data
 */
export function createProfileData(overrides = {}) {
  return {
    bio: 'Test bio',
    avatarUrl: 'https://example.com/avatar.png',
    ...overrides,
  };
}

// ============================================================================
// Example: API Client Helpers
// ============================================================================

/**
 * Creates a session by signing in with credentials
 */
export async function createSession(email: string, password: string) {
  const { headers } = await auth.api.signInEmail({
    body: { email, password },
    returnHeaders: true,
  });

  return headers.getSetCookie()[0];
}

/**
 * Makes an authenticated request using a cookie
 */
export async function makeAuthenticatedRequest(
  cookie: string,
  endpoint: string,
  data: any
) {
  return fetch(`http://localhost:3000${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie,
    },
    body: JSON.stringify(data),
  });
}

// ============================================================================
// Example: Database Helpers
// ============================================================================

/**
 * Cleans up all data for a specific user
 */
export async function cleanUserData(userId: string) {
  // Example - adjust to your models
  // await Promise.all([
  //   UserProfileModel.deleteMany({ userId }),
  //   UserAchievementModel.deleteMany({ userId }),
  //   UserBadgeModel.deleteMany({ userId }),
  // ]);
}

/**
 * Seeds test achievements into the database
 */
export async function seedAchievements() {
  // Example - adjust to your models
  // const achievements = [
  //   { id: 'FIRST_LOGIN', label: 'First Login', description: '...' },
  //   { id: 'BETA_TESTER', label: 'Beta Tester', description: '...' },
  // ];
  // 
  // await AchievementModel.insertMany(achievements);
}

// ============================================================================
// Example: Async Wait Utilities
// ============================================================================

/**
 * Waits for a condition to be true
 * 
 * @param condition - Function returning boolean or promise of boolean
 * @param timeout - Max time to wait in milliseconds (default 5000)
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000
) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error('Condition not met within timeout');
}

// Usage example:
// await waitFor(async () => {
//   const user = await UserModel.findById(userId);
//   return user?.status === 'ACTIVE';
// });
