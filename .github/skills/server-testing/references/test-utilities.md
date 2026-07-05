# Test Utilities

Reusable helpers, fixtures, and utilities that make writing tests easier and more consistent.

## Primary Mission: Build a Fixture Library

The most important role of test utilities is **building a library of specialized fixtures that express test intent clearly**. Instead of repeating setup code or calling endpoints directly in tests, create domain-specific fixtures.

### Fixture Philosophy

```typescript
// ❌ BAD: Test has to know how to set up complex scenarios
it('should select badge', async () => {
  const { ctx, user } = await createUser();
  
  // How do we grant achievements? This couples the test to implementation
  await call(appRouter.achievements.grant, { achievementId: 'BETA' }, ctx());
  await call(appRouter.achievements.grant, { achievementId: 'TESTER' }, ctx());
  
  const result = await call(appRouter.user.updateUserBadge, { badgeId: 'BETA_BADGE' }, ctx());
  expect(result.selectedBadge).toBe('BETA_BADGE');
});

// ✅ GOOD: Fixture expresses intent, test is clean
it('should select badge', async () => {
  const { ctx } = await createUserWithAchievements(['BETA', 'TESTER']);
  
  const result = await call(appRouter.user.updateUserBadge, { badgeId: 'BETA_BADGE' }, ctx());
  expect(result.selectedBadge).toBe('BETA_BADGE');
});
```

**Key Benefits of a Rich Fixture Library:**
- Tests express intent immediately (what scenario?)
- Setup code is centralized and maintainable
- Changes to how scenarios are created only affect fixtures, not tests
- New team members understand test purpose quickly
- Reduces cognitive load—tests stay simple and readable

## Core Test Helpers

### createUser()

Creates an authenticated user with a session. This is the primary test utility for integration tests.

**Location**: `test/integration/utilities.ts`

```typescript
import { createUser } from './utilities';

// Create user with random data
const { ctx, user, session, cookie } = await createUser();

// Create user with specific data
const { ctx, user } = await createUser({
  email: 'test@example.com',
  name: 'Test User',
  password: 'password123',
});
```

**Returns**:
- `ctx()` - Function that returns oRPC context with session
- `user` - Better Auth user object with `id`, `email`, `name`
- `session` - Session object
- `cookie` - Authentication cookie string

### getIntegrationFixtures()

Gets the loaded app instance, router, and auth client.

**Location**: `test/helpers/fixtures.ts`

```typescript
import { getIntegrationFixtures } from '../helpers/fixtures';

const { app, appRouter, auth } = await getIntegrationFixtures();
```

### Direct Access to Instances

Import pre-loaded instances directly for convenience:

**Location**: `test/helpers/instance.ts`

```typescript
import { app, appRouter, auth } from '../helpers/instance';

// Use directly in tests
const result = await call(appRouter.user.getUserProfile, null, ctx());
```

## Custom Matchers

### toBeNil()

Checks if value is `null` or `undefined`.

**Location**: `test/helpers/matchers.ts`

```typescript
// Passes
expect(null).toBeNil();
expect(undefined).toBeNil();

// Fails
expect('value').toBeNil();
expect(0).toBeNil();

// With .not
expect('value').not.toBeNil();
expect(0).not.toBeNil();
```

**Type Safety**: Automatically augments Vitest types so TypeScript knows about the matcher.

## Creating Custom Test Utilities

### Pattern 1: Specialized User Fixtures (Most Important)

Create domain-specific fixtures that represent meaningful test scenarios. These become the building blocks of your test suite.

Fixtures should call endpoints via `call()` to ensure full API testing.

```typescript
// test/integration/utilities.ts

/**
 * User with admin privileges
 */
export async function createAdminUser() {
  const user = await createUser({
    email: `admin-${Date.now()}@example.com`,
    name: 'Admin User',
    password: 'admin123',
  });

  // Grant admin role via endpoint
  await call(appRouter.admin.grantRole, { userId: user.user.id, role: 'ADMIN' }, user.ctx());
  
  return user;
}

/**
 * User with specific achievements granted
 */
export async function createUserWithAchievements(achievementIds: string[]) {
  const user = await createUser();

  // Grant achievements via endpoints
  await Promise.all(
    achievementIds.map((id) =>
      call(appRouter.achievements.grant, { achievementId: id }, user.ctx())
    )
  );

  return user;
}

/**
 * User with specific badge selected and required achievements
 */
export async function createUserWithBadge(badgeId: string) {
  // Compose existing fixtures
  const { ctx, user } = await createUserWithAchievements(['required_achievement']);
  
  // Set the badge via endpoint
  await call(appRouter.user.updateUserBadge, { badgeId }, ctx());
  
  return { ctx, user };
}
```

**Key Pattern**: Fixtures call endpoints via `call()` to ensure they test the full API layer, not just the business logic.

### Pattern 2: Building Complex Scenarios

Compose simple fixtures into more complex ones:

```typescript
/**
 * User with a completed challenge
 */
export async function createUserWithCompletedChallenge() {
  const user = await createUser();
  // Create and complete a challenge via endpoint
  const challenge = await call(appRouter.challenges.create, { title: 'Test Challenge' }, user.ctx());
  await call(appRouter.challenges.submit, { challengeId: challenge.id, answer: '...' }, user.ctx());
  
  return { user, challenge };
}

/**
 * Team with multiple members at different permission levels
 */
export async function createTeamWithMembers() {
  const owner = await createAdminUser();
  const member1 = await createUser();
  const member2 = await createUser();
  
  // Create team and add members via endpoints
  const team = await call(appRouter.teams.create, { name: 'Test Team' }, owner.ctx());
  await call(appRouter.teams.addMember, { teamId: team.id, userId: member1.user.id, role: 'MEMBER' }, owner.ctx());
  await call(appRouter.teams.addMember, { teamId: team.id, userId: member2.user.id, role: 'EDITOR' }, owner.ctx());
  
  return { owner, team, member1, member2 };
}
```

### Pattern 3: Specific Scenario Fixtures

Create fixtures for specific scenarios by composing simpler fixtures and calling endpoints:

```typescript
export async function createCompletedSubmission() {
  const user = await createUser();
  
  // Create challenge and submission via endpoints
  const challenge = await call(appRouter.challenges.create, { title: 'Challenge' }, user.ctx());
  const submission = await call(appRouter.challenges.submit, { challengeId: challenge.id, answer: '...' }, user.ctx());
  
  return { user, challenge, submission };
}
```

### Pattern 4: Data Factory Functions

Generate random test data:

```typescript
export function createChallengeData(overrides = {}) {
  return {
    title: 'Test Challenge',
    description: 'Test Description',
    difficulty: 'MEDIUM',
    points: 100,
    ...overrides,
  };
}

export function createProfileData(overrides = {}) {
  return {
    bio: 'Test bio',
    avatarUrl: 'https://example.com/avatar.png',
    ...overrides,
  };
}
```

## Custom Matchers

Define domain-specific matchers for cleaner assertions:

```typescript
// test/helpers/matchers.ts

import { expect } from 'vitest';

expect.extend({
  toHaveValidTimestamps(received) {
    const hasCreatedAt = received.createdAt instanceof Date;
    const hasUpdatedAt = received.updatedAt instanceof Date;

    if (hasCreatedAt && hasUpdatedAt) {
      return {
        message: () => `expected object not to have valid timestamps`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected object to have valid createdAt and updatedAt`,
        pass: false,
      };
    }
  },
});

// Type augmentation
declare module 'vitest' {
  interface Assertion<T = any> {
    toHaveValidTimestamps(): T;
  }
}

// Usage
expect(profile).toHaveValidTimestamps();
```

### Pattern: API Client Helpers

Wrap common API operations:

```typescript
// test/integration/utilities.ts

export async function createSession(email: string, password: string) {
  const { headers } = await auth.api.signInEmail({
    body: { email, password },
    returnHeaders: true,
  });

  return headers.getSetCookie()[0];
}

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
```

## Test Database Helpers

Direct database manipulation for test setup:

```typescript
import { UserModel } from '@~/db/models/user.model';
import { UserProfileModel } from '@~/db/models/user-profile.model';

// Clean specific collections
export async function cleanUserData(userId: string) {
  await Promise.all([
    UserProfileModel.deleteMany({ userId }),
    UserAchievementModel.deleteMany({ userId }),
  ]);
}

// Seed test data
export async function seedAchievements() {
  const achievements = [
    { id: 'FIRST_LOGIN', label: 'First Login', description: '...' },
    { id: 'BETA_TESTER', label: 'Beta Tester', description: '...' },
  ];

  await AchievementModel.insertMany(achievements);
}
```

## Setup Hooks Utilities

### beforeEach / afterEach Helpers

```typescript
import { beforeEach, afterEach } from 'vitest';

describe('Feature with Shared Setup', () => {
  let testUser: Awaited<ReturnType<typeof createUser>>;

  beforeEach(async () => {
    testUser = await createUser();
    // Additional setup
  });

  afterEach(async () => {
    // Optional: explicit cleanup (though automatic cleanup handles most cases)
  });

  it('uses shared testUser', async () => {
    const result = await call(
      appRouter.user.getUserProfile,
      null,
      testUser.ctx()
    );
    expect(result).toBeDefined();
  });
});
```

## Container Management

Reset DI container and app cache when needed:

```typescript
import { resetContainer } from '../helpers/fixtures';
import { resetAppCache } from '../helpers/instance';

// Reset DI container
resetContainer();

// Reset app cache (forces reload)
await resetAppCache();
```

**When to use**: Rarely needed, as tests are isolated by default. Use only when testing container configuration itself.

## Environment Utilities

Access test environment configuration:

```typescript
// Environment variables are set in vitest.config.ts
process.env.NODE_ENV; // 'test'
process.env.MONGO_DATABASE_NAME; // 'startername-test-{workerId}'
process.env.MONGO_URI; // MongoDB Memory Server URI
```

## Async Test Utilities

### waitFor Pattern

For tests that need to wait for async operations:

```typescript
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

// Usage
await waitFor(async () => {
  const user = await UserModel.findById(userId);
  return user?.status === 'ACTIVE';
});
```

## Best Practices

1. **Build fixtures before tests** - Create domain-specific fixtures first, then write tests using them
2. **Call endpoints in fixtures** - Fixtures use `call()` to test the full API layer
3. **Keep utilities DRY** - Extract repeated setup into utilities
4. **Make utilities composable** - Small, focused functions that combine well
5. **Document utility functions** - Add JSDoc comments for complex helpers
6. **Use TypeScript** - Ensure type safety in test utilities
7. **Avoid over-abstraction** - Balance reusability with clarity
8. **Co-locate utilities** - Put test-specific utilities near tests
9. **Export from utilities.ts** - Make all fixtures discoverable in one place

### Fixture Naming Convention

```typescript
// ✅ GOOD: Clear purpose from name
export async function createUserWithAchievements(ids: string[]) { }
export async function createAdminUser() { }
export async function createTeamWithMembers() { }
export async function createCompletedChallenge() { }

// ❌ AVOID: Vague names
export async function setupTest1() { }
export async function getUser() { }
export async function prepareData() { }
```

## Common Utilities Checklist

When building your fixture library, consider creating:
- ✅ Basic user creation (`createUser`)
- ✅ Specialized user types (`createAdminUser`, `createUserWithAchievements`)
- ✅ Complex scenarios (`createTeamWithMembers`, `createCompletedChallenge`)
- ✅ Data factories (`createChallengeData`, `createProfileData`)
- ✅ Custom matchers (`toHaveValidTimestamps`, `toBeValidId`)
- ✅ Database helpers (`seedAchievements`, `cleanUserData`)
- ✅ Async utilities (`waitFor`, `waitForCondition`)

## Anti-Patterns to Avoid

❌ Don't call endpoints in tests (encapsulate in fixtures)
❌ Don't repeat setup code across tests (extract to fixture)
❌ Don't have fixtures that are too generic (be specific)
❌ Don't forget to document fixture purpose
❌ Don't mix setup concerns in test files (keep in utilities)

✅ Do call endpoints in fixtures to test the full API
✅ Do create specialized fixtures for each scenario
✅ Do reuse fixtures across multiple tests
✅ Do update fixtures in one place when APIs change
✅ Do name fixtures descriptively
✅ Do compose fixtures for complex scenarios
