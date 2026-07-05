# Common Issues

Troubleshooting guide for common test errors and problems.

## "Accessed Before Declaration" Error

### The Error

```
ReferenceError: Cannot access 'VariableName' before initialization
```

or

```
ReferenceError: Cannot access 'SomeClass' before initialization
    at <module>
```

### Critical Understanding

**This error indicates a problem in your SOURCE CODE, not your tests.**

The error occurs during module loading, before your test even runs. This means:
- The issue is in the code being tested
- Fixing the test file will NOT help
- You must fix the source code's import structure

### Root Causes

#### 1. Circular Dependencies (Most Common)

Two or more modules import each other, creating a cycle:

```typescript
// ❌ BAD: Circular dependency

// file-a.ts
import { functionB } from './file-b';
export function functionA() {
  return functionB();
}

// file-b.ts
import { functionA } from './file-a';  // Circular!
export function functionB() {
  return functionA();
}
```

**Symptoms**:
- Error mentions accessing a variable/class before initialization
- Occurs when importing the module
- Happens before tests run

**Solution**:
- Move shared code to a third file
- Restructure to break the cycle
- Use dependency injection

```typescript
// ✅ GOOD: Break the cycle

// shared.ts
export interface IConfig {
  // shared types
}

// file-a.ts
import { IConfig } from './shared';
export function functionA(config: IConfig) {
  // implementation
}

// file-b.ts
import { IConfig } from './shared';
export function functionB(config: IConfig) {
  // implementation
}
```

#### 2. Import Order Problems

Importing something before it's defined, often in barrel exports:

```typescript
// ❌ BAD: Wrong import order

// index.ts
export * from './feature-a';
export * from './feature-b';  // feature-b uses feature-a

// feature-b.ts
import { FeatureA } from './index';  // Imports before FeatureA is exported!
```

**Solution**:
- Import directly from source files, not barrel exports
- Reorder exports in barrel files
- Avoid circular barrel exports

```typescript
// ✅ GOOD: Direct imports

// feature-b.ts
import { FeatureA } from './feature-a';  // Direct import
```

#### 3. Top-Level Execution Issues

Code executing at module load time that depends on other modules:

```typescript
// ❌ BAD: Top-level execution

// service.ts
import { config } from './config';

// This runs immediately when module loads!
const instance = new ServiceClass(config.getValue());
export { instance };
```

**Solution**:
- Use factory functions
- Lazy initialization
- Dependency injection

```typescript
// ✅ GOOD: Lazy initialization

// service.ts
import { config } from './config';

let instance: ServiceClass | null = null;

export function getServiceInstance() {
  if (!instance) {
    instance = new ServiceClass(config.getValue());
  }
  return instance;
}
```

### Debugging Steps

1. **Identify the module** causing the error from the stack trace
2. **Check imports** in that module for circular dependencies
3. **Draw a dependency graph** if needed:
   ```
   ModuleA → ModuleB → ModuleC → ModuleA (circular!)
   ```
4. **Break the cycle** by:
   - Extracting shared code
   - Using interfaces instead of concrete imports
   - Restructuring module boundaries

### Example: Real-World Fix

**Before** (circular dependency):

```typescript
// user.service.ts
import { AchievementService } from './achievement.service';

export class UserService {
  async createUser() {
    // uses AchievementService
  }
}

// achievement.service.ts
import { UserService } from './user.service';  // Circular!

export class AchievementService {
  async grantAchievement() {
    // uses UserService
  }
}
```

**After** (fixed with DI):

```typescript
// user.service.ts
import { injectable, inject } from 'tsyringe';
import { TOKENS } from './tokens';

@injectable()
export class UserService {
  constructor(
    @inject(TOKENS.AchievementService)
    private achievementService: IAchievementService
  ) {}

  async createUser() {
    // uses this.achievementService
  }
}

// achievement.service.ts
import { injectable } from 'tsyringe';

@injectable()
export class AchievementService implements IAchievementService {
  async grantAchievement() {
    // no direct import of UserService
  }
}
```

### Prevention

- ✅ Use dependency injection (tsyringe)
- ✅ Define interfaces in separate files
- ✅ Avoid barrel exports for internal modules
- ✅ Keep module boundaries clear
- ✅ Run tests frequently to catch issues early

## Test Timeout Errors

### The Error

```
Test timed out in 10000ms
```

### Causes and Solutions

#### 1. Missing await

```typescript
// ❌ BAD: Forgot await
it('should create user', () => {
  createUser();  // Returns promise but not awaited!
});

// ✅ GOOD: Properly awaited
it('should create user', async () => {
  await createUser();
});
```

#### 2. Infinite Loop in Code

```typescript
// ❌ BAD: Infinite loop
export function processData() {
  while (true) {  // Never exits!
    // process
  }
}

// ✅ GOOD: Proper exit condition
export function processData() {
  while (hasMoreData()) {
    // process
  }
}
```

#### 3. Unclosed Connections

```typescript
// ❌ BAD: Connection not closed
it('should test external API', async () => {
  const client = new ApiClient();
  await client.makeRequest();
  // client never closed!
});

// ✅ GOOD: Proper cleanup
it('should test external API', async () => {
  const client = new ApiClient();
  try {
    await client.makeRequest();
  } finally {
    await client.close();
  }
});
```

## Import/Module Not Found Errors

### The Error

```
Cannot find module '@~/some/module'
```

### Solutions

#### 1. Check Path Alias

Ensure the `@~/` alias is correctly configured in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@~/*": ["./src/*"]
    }
  }
}
```

#### 2. Verify File Extension

TypeScript files should omit the `.ts` extension:

```typescript
// ✅ GOOD
import { User } from '@~/db/models/user.model';

// ❌ BAD
import { User } from '@~/db/models/user.model.ts';
```

#### 3. Check File Exists

Verify the file actually exists at the path:

```bash
ls apps/server/src/db/models/user.model.ts
```

## Database Connection Errors

### The Error

```
MONGO_URI was not provided to test setup
```

### Cause

The global setup didn't run or failed to start MongoDB Memory Server.

### Solutions

1. **Verify global setup is configured**:
   ```typescript
   // vitest.config.ts
   globalSetup: ['./test/global-setup.ts'],
   ```

2. **Check MongoDB Memory Server**:
   ```bash
   # May need to download MongoDB binary first time
   pnpm run test
   ```

3. **Restart test runner**:
   ```bash
   # Kill and restart
   pkill -f vitest
   pnpm run test
   ```

## Type Errors in Tests

### The Error

```
Argument of type 'X' is not assignable to parameter of type 'Y'
```

### Common Causes

#### 1. Missing Type Augmentation

Custom matchers need type definitions:

```typescript
// ❌ Missing types
expect(value).toBeNil();  // TypeScript error: Property 'toBeNil' does not exist

// ✅ Add type augmentation
declare module 'vitest' {
  interface Assertion<T = any> {
    toBeNil(): T;
  }
}
```

#### 2. Wrong Context Type

```typescript
// ❌ BAD: Wrong context structure
const result = await call(
  appRouter.user.getProfile,
  null,
  { session: { user } }  // Incorrect structure!
);

// ✅ GOOD: Use ctx() from createUser
const { ctx } = await createUser();
const result = await call(
  appRouter.user.getProfile,
  null,
  ctx()  // Correct structure
);
```

## Flaky Tests

### Symptoms

Tests pass sometimes and fail other times without code changes.

### Common Causes

#### 1. Race Conditions

```typescript
// ❌ FLAKY: Race condition
it('should process async operation', async () => {
  triggerAsyncOperation();  // No await!
  const result = await getResult();  // Might not be ready
  expect(result).toBeDefined();
});

// ✅ STABLE: Proper sequencing
it('should process async operation', async () => {
  await triggerAsyncOperation();
  const result = await getResult();
  expect(result).toBeDefined();
});
```

#### 2. Shared State

```typescript
// ❌ FLAKY: Shared mutable state
let counter = 0;

it('test 1', () => {
  counter++;
  expect(counter).toBe(1);  // Fails if test 2 runs first!
});

it('test 2', () => {
  counter++;
  expect(counter).toBe(1);
});

// ✅ STABLE: Isolated state
it('test 1', () => {
  let counter = 0;
  counter++;
  expect(counter).toBe(1);
});
```

#### 3. Timing Dependencies

```typescript
// ❌ FLAKY: Relies on timing
it('should update after delay', async () => {
  updateValue();
  await new Promise(resolve => setTimeout(resolve, 100));  // Arbitrary delay!
  expect(value).toBe('updated');
});

// ✅ STABLE: Wait for actual condition
it('should update after delay', async () => {
  updateValue();
  await waitFor(() => value === 'updated');  // Wait for condition
  expect(value).toBe('updated');
});
```

## Assertion Errors

### The Error

```
AssertionError: expected 'actual' to equal 'expected'
```

### Debugging Tips

1. **Add descriptive messages**:
   ```typescript
   expect(user.email).toBe('test@example.com', 'User email should match');
   ```

2. **Use better matchers**:
   ```typescript
   // Instead of toBe for objects
   expect(result).toEqual(expected);

   // For partial matching
   expect(result).toMatchObject({ id: 'expected-id' });
   ```

3. **Log values**:
   ```typescript
   console.log('Actual value:', actual);
   console.log('Expected value:', expected);
   expect(actual).toBe(expected);
   ```

## Getting Help

If you encounter an error not covered here:

1. **Check the stack trace** - Identifies where the error occurs
2. **Read the error message carefully** - Often contains the solution
3. **Search the codebase** - Look for similar patterns
4. **Check test setup files** - `test/helpers/setup.ts`, `test/global-setup.ts`
5. **Verify environment** - Node version, dependencies installed
6. **Run type checking** - `pnpm run check-types`

## Prevention Checklist

- ✅ Run tests frequently during development
- ✅ Use watch mode for immediate feedback
- ✅ Keep test setup simple and consistent
- ✅ Avoid circular dependencies
- ✅ Use dependency injection
- ✅ Write tests before fixing bugs (TDD)
- ✅ Keep tests isolated and independent
