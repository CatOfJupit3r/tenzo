---
name: server-testing
description: Write and run tests for the server using Vitest. Prefer integration tests for features and use unit tests only for utilities and helpers. Use when creating tests for routers, services, models, implementing test utilities, debugging test failures, or running tests. Includes guidance on the "accessed before declaration" error which indicates errors in the CODE being tested, not the test itself.
---

# Server Testing

Write comprehensive tests for the server using Vitest with a focus on integration testing.

## Core Principles

1. **Prefer Integration Tests**: Test features end-to-end through routers and services
2. **Unit Tests for Utilities Only**: Reserve unit tests for pure functions and helpers
3. **Use Specialized Fixtures**: Always create and reuse domain-specific fixtures for test setup. Instead of calling endpoints directly (which couples tests to API contracts), build fixtures like `createUser()`, `createUserWithAchievements()`, etc. This makes tests more maintainable and intent-clear
4. **Clean Database Between Tests**: Automatic cleanup ensures test isolation
5. **Type-Safe Testing**: Use oRPC's `call()` for invoking routers with full type safety

## Quick Reference

| Topic | Use When |
|-------|----------|
| [Integration Tests](references/integration-tests.md) | Testing routers, services, and full feature flows |
| [Unit Tests](references/unit-tests.md) | Testing utilities, helpers, and pure functions |
| [Test Utilities](references/test-utilities.md) | Creating fixtures, helpers, and custom matchers |
| [Running Tests](references/running-tests.md) | Executing tests locally and debugging failures |
| [Common Issues](references/common-issues.md) | Troubleshooting "accessed before declaration" and other errors |

## Running Tests

```bash
# Run all tests once
pnpm run test

# Watch mode (re-run on changes)
pnpm run test:watch

# UI mode (visual test runner)
pnpm run test:ui
```

All commands should be run from `apps/server/` or the monorepo root.

## Test Structure

```
apps/server/test/
├── integration/           # Integration tests (preferred)
│   ├── auth.test.ts
│   ├── user-profile.test.ts
│   ├── achievements.test.ts
│   └── utilities.ts      # Shared test helpers
├── unit/                 # Unit tests (utilities only)
│   └── matchers.test.ts
└── helpers/              # Test setup and configuration
    ├── setup.ts          # Database and environment setup
    ├── instance.ts       # App instance management
    ├── fixtures.ts       # Reusable fixtures
    └── matchers.ts       # Custom matchers (toBeNil, etc.)
```

## When to Write Which Type of Test

### Integration Tests (Preferred)

Write integration tests for:
- ✅ Router endpoints
- ✅ Service layer logic
- ✅ Database operations
- ✅ Authentication/authorization flows
- ✅ Cross-feature interactions

Integration tests provide the most value by testing the full stack as users experience it.

### Unit Tests (Sparingly)

Only write unit tests for:
- ✅ Pure utility functions
- ✅ Data transformers
- ✅ Custom matchers
- ✅ Helper functions

Avoid unit testing services or routers—use integration tests instead.

## Quick Start: Writing an Integration Test

```typescript
import { call } from '@orpc/server';
import { describe, it, expect } from 'vitest';

import { appRouter } from '../helpers/instance';
import { createUser, createUserWithAchievements } from './utilities';

describe('Feature Name', () => {
  it('should perform action successfully', async () => {
    // Setup: Use specialized fixture instead of calling endpoints
    const { ctx, user } = await createUser();

    // Execute: Call the router
    const result = await call(
      appRouter.feature.action,
      { input: 'data' },
      ctx()
    );

    // Assert: Verify the result
    expect(result).not.toBeNil();
    expect(result.someField).toBe('expected value');
  });

  it('should handle users with achievements', async () => {
    // Use specialized fixture for specific test scenario
    const { ctx, user } = await createUserWithAchievements(['ACHIEVEMENT_1']);

    const result = await call(
      appRouter.feature.restrictedAction,
      { actionData: 'test' },
      ctx()
    );

    expect(result).toBeDefined();
  });

  it('should reject unauthorized access', async () => {
    const { ctx } = await createUser();

    // Test error case
    await expect(
      call(appRouter.feature.restrictedAction, {}, ctx())
    ).rejects.toThrow();
  });
});
```

**Key Pattern**: Create specialized fixtures (`createUser`, `createUserWithAchievements`, etc.) instead of calling endpoints directly. This keeps tests:
- Focused on what's being tested
- Independent from API implementation details
- Easier to maintain when fixtures change

## Critical: "Accessed Before Declaration" Error

**This error indicates a problem in your CODE, not your tests.**

When you see:
```
ReferenceError: Cannot access 'VariableName' before initialization
```

The issue is typically:
1. **Circular dependency** in your source code
2. **Import order problem** in your modules
3. **Top-level await** used incorrectly

**Do NOT try to fix this in your test file.** Instead:
- Check the source file being tested for circular imports
- Look for modules importing each other
- Verify initialization order in loaders and DI container

See [references/common-issues.md](references/common-issues.md) for detailed troubleshooting.

## Custom Matchers

The project includes custom Vitest matchers:

```typescript
// Check for null or undefined
expect(value).toBeNil();
expect(value).not.toBeNil();
```

Defined in `test/helpers/matchers.ts` and auto-loaded for all tests.

## Test Database

Tests use MongoDB Memory Server for isolation:
- Each test worker gets a separate database
- Database is cleared between tests (not dropped, for speed)
- No need to manually clean up—handled by `afterEach` in setup

## See Also

- **examples/integration-test.ts** - Complete integration test example
- **examples/unit-test.ts** - Unit test example for utilities
- **examples/test-utilities.ts** - Creating custom test helpers
