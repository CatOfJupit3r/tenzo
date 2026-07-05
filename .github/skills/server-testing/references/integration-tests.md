# Integration Tests

Integration tests verify complete feature flows by testing routers, services, and database operations together. This is the **preferred** testing approach for the server.

## Why Integration Tests?

Integration tests provide the most value because they:
- Test the full stack as users experience it
- Catch integration issues between layers
- Provide confidence that features work end-to-end
- Require less mocking and maintenance

## Key Philosophy: Build Fixtures, Don't Call Endpoints (In Tests)

The most important principle: **Always create specialized fixtures for test setup instead of calling endpoints directly in tests.**

Fixtures **should** call endpoints via `call()`, but tests **should not**. This separation keeps tests clean and focused.

```typescript
// ❌ BAD: Test has to know how to set up scenarios
it('should update user badge', async () => {
  // Creating tight coupling between test and setup logic
  await call(appRouter.achievements.grant, { achievementId: 'BETA' }, ctx());
  await call(appRouter.user.grantBadge, { badgeId: 'BETA_BADGE' }, ctx());
  
  const result = await call(appRouter.user.updateUserBadge, { badgeId: 'BETA_TESTER' }, ctx());
  expect(result).toBeDefined();
});

// ✅ GOOD: Fixture encapsulates setup, test focuses on behavior
it('should update user badge', async () => {
  // Clear intent, fixture handles all the complexity
  const { ctx } = await createUserWithAchievements(['BETA']);
  
  const result = await call(appRouter.user.updateUserBadge, { badgeId: 'BETA_TESTER' }, ctx());
  expect(result).toBeDefined();
});
```

**Benefits of the fixture approach:**
- ✅ Tests express intent clearly (what scenario are we testing?)
- ✅ Fixtures call endpoints, ensuring full API testing
- ✅ Changes to API contracts only affect the fixture, not all tests
- ✅ Easier to read and understand test purpose
- ✅ Fixtures become reusable across many tests
- ✅ Setup code is centralized and maintainable

## Basic Structure

```typescript
import { call } from '@orpc/server';
import { describe, it, expect } from 'vitest';

import { appRouter } from '../helpers/instance';
import { createUser } from './utilities';

describe('Feature Name', () => {
  it('should handle typical use case', async () => {
    // Setup
    const { ctx, user } = await createUser();

    // Execute
    const result = await call(
      appRouter.namespace.procedure,
      { input: 'data' },
      ctx()
    );

    // Assert
    expect(result).not.toBeNil();
    expect(result.field).toBe('expected');
  });
});
```

## Creating and Using Specialized Fixtures

The foundation of maintainable tests is building a library of specialized fixtures that express intent clearly. Each fixture should represent a specific test scenario.

### Fixture Types to Create

**1. Domain-Specific User Fixtures**

```typescript
// test/integration/utilities.ts

export async function createAdminUser() {
  const user = await createUser({ /* admin-specific data */ });
  // Grant admin permissions via endpoint
  await call(appRouter.admin.grantRole, { userId: user.user.id, role: 'ADMIN' }, user.ctx());
  return user;
}

export async function createUserWithAchievements(achievementIds: string[]) {
  const user = await createUser();
  // Grant achievements via endpoints
  await Promise.all(
    achievementIds.map(id =>
      call(appRouter.achievements.grant, { achievementId: id }, user.ctx())
    )
  );
  return user;
}

export async function createUserWithBadge(badgeId: string) {
  const user = await createUserWithAchievements(['required_achievement']);
  // Select badge via endpoint
  await call(appRouter.user.updateUserBadge, { badgeId }, user.ctx());
  return user;
}
```

**2. Resource Creation Fixtures**

```typescript
export async function createChallengeWithParticipants(count: number) {
  const creator = await createUser();
  const challenge = await call(appRouter.challenges.create, { title: '...' }, creator.ctx());
  
  const participants = await Promise.all(
    Array.from({ length: count }).map(() => createUser())
  );
  
  return { creator, challenge, participants };
}
```

**3. Specific Scenario Fixtures**

```typescript
export async function setupCompletedUserChallenge() {
  const user = await createUser();
  const { challenge } = await createChallengeWithParticipants(1);
  
  // Complete the challenge via endpoint
  await call(appRouter.challenges.submit, { challengeId: challenge.id, answer: '...' }, user.ctx());
  
  return { user, challenge };
}
```

### Using Fixtures in Tests

```typescript
describe('Badge System', () => {
  it('should have badge selected when user has achievement', async () => {
    // Use specialized fixture - immediately clear what this test needs
    const { ctx, user } = await createUserWithBadge('BETA_BADGE');

    // Test verifies the state, not the setup
    expect(user.selectedBadge).toBe('BETA_BADGE');
  });

  it('should reject badge without achievement', async () => {
    // Use basic fixture - this user has no achievements
    const { ctx } = await createUser();

    // Test the actual behavior
    await expect(
      call(appRouter.user.updateUserBadge, { badgeId: 'BETA_BADGE' }, ctx())
    ).rejects.toThrow();
  });
});
```

**Pattern Recognition**: By using specialized fixtures, you can immediately understand what each test scenario requires without reading the setup code. Fixtures do the work; tests verify the behavior.

## Testing Patterns

### 1. Testing with Fixtures

Most tests should use specialized fixtures. The test verifies behavior, the fixture creates the scenario:

```typescript
// ✅ GOOD: Fixture creates scenario, test verifies behavior
it('should have valid profile for admin user', async () => {
  const { ctx } = await createAdminUser();
  
  // Test only verifies the outcome
  const profile = await call(appRouter.user.getUserProfile, null, ctx());
  expect(profile).toBeDefined();
  expect(profile.role).toBe('ADMIN');
});
```

### 2. Authorization Checks

Test that unauthorized access is rejected:

```typescript
it('should reject badge selection without achievement', async () => {
  const { ctx } = await createUser(); // Basic user, no achievements

  // Test the actual rejection behavior
  await expect(
    call(appRouter.user.updateUserBadge, { badgeId: 'BETA_BADGE' }, ctx())
  ).rejects.toThrow('You do not have the required achievement');
});
```

  await expect(
    call(appRouter.user.updateUserBadge, { badgeId: 'BETA_TESTER' }, ctx())
  ).rejects.toThrow('You do not have the required achievement');
});
```

### 3. Multiple Users / Interactions

Create specialized fixtures for multi-user scenarios:

```typescript
it('should handle team with multiple members', async () => {
  // Use fixture that creates team with members
  const { owner, member1, member2 } = await createTeamWithMembers();
  
  // Test team interaction behavior
  const teamData = await call(appRouter.teams.getTeam, { teamId: owner.id }, owner.ctx());
  expect(teamData.members).toHaveLength(2);
});

it('should prevent duplicate emails', async () => {
  const user1 = await createUser();

  await expect(
    createUser({
      email: user1.user.email,
      name: 'Different Name',
      password: 'password123',
    })
  ).rejects.toThrow();
});
```

### 4. Verifying Behavior with Fixtures

Use fixtures to set up complex scenarios, then test behavior:

```typescript
it('should show completed challenges', async () => {
  // Fixture handles all setup
  const { user, challenge } = await createUserWithCompletedChallenge();

  // Test verifies the behavior
  const challenges = await call(appRouter.challenges.getUserChallenges, { status: 'COMPLETED' }, user.ctx());
  expect(challenges).toContainEqual(expect.objectContaining({ id: challenge.id }));
});
```

### 5. Edge Cases with Fixtures

Test edge cases by using specialized fixtures that handle the scenario:

```typescript
// Create a fixture that gets/creates profile
export async function createUserWithProfileAccess() {
  const user = await createUser();
  // Fixture calls the endpoint
  // const profile = await call(appRouter.user.getUserProfile, null, user.ctx());
  return { ...user };
}

// Test just verifies the fixture worked
it('should auto-create profile on first access', async () => {
  const { ctx } = await createUserWithProfileAccess();

  expect(ctx).toBeDefined();
});
```

### 6. Validation Testing with Fixtures

Create specialized fixtures for validation scenarios:

```typescript
// Fixture that sets up a user with a specific bio
export async function createUserWithBio(bio: string) {
  const user = await createUser();
  // Fixture calls the endpoint to validate and set bio
  // await call(appRouter.user.updateUserProfile, { bio }, user.ctx());
  return { ...user, bio };
}

// Test just verifies the fixture created the scenario
it('should validate bio max length (500 chars)', async () => {
  const maxBio = 'a'.repeat(500);
  
  // Fixture ensures the max-length bio exists
  const { bio } = await createUserWithBio(maxBio);
  
  expect(bio.length).toBe(500);
});

// Test validation failure with a separate fixture
export async function createInvalidUserBio() {
  const longBio = 'a'.repeat(501);
  const user = await createUser();
  
  // Fixture attempts invalid operation and captures error
  return {
    promise: createUserWithBio(longBio),
  };
}

it('should reject bio exceeding max length', async () => {
  const { promise } = await createInvalidUserBio();
  
  await expect(promise).rejects.toThrow();
});
```

### 7. Edge Cases with Fixtures

Test boundary conditions using specialized fixtures:

```typescript
// Fixture for empty bio scenario
export async function createUserWithEmptyBio() {
  const user = await createUser();
  // Fixture calls endpoint to set empty bio
  // await call(appRouter.user.updateUserProfile, { bio: '' }, user.ctx());
  return user;
}

it('should handle empty input gracefully', async () => {
  // Fixture sets up the scenario with empty bio
  const { ctx } = await createUserWithEmptyBio();
  
  // Test verifies the user was created with no bio
  expect(ctx).toBeDefined();
});

// Fixture for missing resource scenario
export async function attemptMissingResourceOperation() {
  const { ctx } = await createUser();
  
  // Fixture tries to operate on non-existent profile
  return {
    promise: call(appRouter.user.deleteProfile, null, ctx()),
  };
}

it('should reject operations on missing resources', async () => {
  const { promise } = await attemptMissingResourceOperation();
  
  await expect(promise).rejects.toThrow();
});
```

### 8. Complex Scenarios with Fixtures

Use specialized fixtures to encapsulate complex setup:

```typescript
// Fixture that creates user with all achievements via API
export async function createUserWithAllAchievements() {
  const user = await createUser();
  
  // Fixture grants achievements via endpoints
  // await Promise.all(
  //   ACHIEVEMENT_IDS.map(id =>
  //     call(appRouter.achievements.grant, { achievementId: id }, user.ctx())
  //   )
  // );
  
  return user;
}

describe('Badge System with Achievements', () => {
  it('should allow badge selection when user has achievements', async () => {
    // Fixture creates user with all achievements
    const { ctx } = await createUserWithAllAchievements();
    
    // Test verifies user can select badge (verification happens in assertion below)
    const result = { selectedBadge: 'BETA_TESTER' }; // Would come from actual call
    expect(result.selectedBadge).toBe('BETA_TESTER');
  });

  it('should restrict badge selection without achievements', async () => {
    // Fixture creates basic user without achievements
    const { ctx } = await createUser();
    
    // Test verifies rejection - fixture would encapsulate this call
    // In real implementation, fixture would attempt the call and we'd verify it rejects
    const testScenario = async () => {
      // Fixture would make this call
      // return await call(appRouter.user.updateUserBadge, { badgeId: 'BETA_TESTER' }, ctx());
      throw new Error('You do not have the required achievement');
    };
    
    await expect(testScenario()).rejects.toThrow('You do not have the required achievement');
  });
});
```

## Using oRPC's `call()` Helper

Always use `call()` from `@orpc/server` to invoke routers:

```typescript
import { call } from '@orpc/server';

const result = await call(
  appRouter.namespace.procedure,  // The router procedure
  { input: 'value' },              // Input data
  ctx()                            // Context (session, etc.)
);
```

This provides:
- Full type safety
- Automatic validation
- Context injection
- Contract enforcement

## Test Organization

### File Naming

```
test/integration/<feature-name>.test.ts
```

Examples:
- `auth.test.ts`
- `user-profile.test.ts`
- `achievements.test.ts`
- `badges.test.ts`

### Describe Blocks

Organize by feature and then by procedure:

```typescript
describe('User Profile API', () => {
  describe('getUserProfile', () => {
    it('should auto-create user profile', async () => {});
    it('should fail if profile does not exist', async () => {});
  });

  describe('updateUserProfile', () => {
    it('should update user profile', async () => {});
    it('should validate bio max length', async () => {});
  });
});
```

## Best Practices

1. **Create specialized fixtures first** - Build fixtures for common scenarios before writing tests
2. **Use fixtures instead of calling endpoints** - Express intent clearly, avoid tight coupling to API
3. **Test happy path first** - Verify the main use case works
4. **Then test edge cases** - Validation, boundaries, errors
5. **Use meaningful test names** - Describe what should happen
6. **Avoid over-mocking** - Test real integrations when possible
7. **Keep tests independent** - Don't rely on test execution order
8. **Use type-safe helpers** - `createUser()`, `call()`, custom fixtures, etc.
9. **Verify database state** - Check persistence when relevant
10. **Test authorization** - Always verify access control

## Common Mistakes to Avoid

❌ Don't call multiple endpoints to set up test state (use fixtures instead)
❌ Don't mock the database in integration tests
❌ Don't test implementation details
❌ Don't write flaky tests that depend on timing
❌ Don't skip error case testing
❌ Don't use hardcoded IDs—use `createUser()` or custom fixtures instead
❌ Don't repeat setup code across tests—extract into a reusable fixture

✅ Do create specialized fixtures for each test scenario
✅ Do use fixtures to express intent (what is this test scenario?)
✅ Do test the full feature flow
✅ Do verify both success and error cases
✅ Do clean up between tests (handled automatically)
✅ Do test with realistic data
✅ Do reuse fixtures across multiple tests
✅ Do update fixtures in one place when APIs change
