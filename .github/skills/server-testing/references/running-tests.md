# Running Tests

Commands and options for running tests locally and in different modes.

## Basic Commands

All commands should be run from `apps/server/` or the monorepo root.

### Run All Tests Once

```bash
pnpm run test
```

Runs all tests (both unit and integration) once and exits.

### Watch Mode

```bash
pnpm run test:watch
```

Watches for file changes and re-runs affected tests automatically. This is ideal for development.

**Features**:
- Re-runs tests when source files change
- Interactive mode with keyboard shortcuts
- Faster feedback loop

**Keyboard shortcuts** in watch mode:
- `a` - Run all tests
- `f` - Run only failed tests
- `t` - Filter by test name pattern
- `p` - Filter by file name pattern
- `q` - Quit watch mode

### UI Mode

```bash
pnpm run test:ui
```

Opens a browser-based UI for running and debugging tests.

**Features**:
- Visual test runner
- Test file browser
- Detailed test results
- Re-run individual tests
- Filter and search tests

Access at: `http://localhost:51204/__vitest__/`

## Running Specific Tests

### Run Tests in a Specific File

```bash
pnpm run test user-profile.test.ts
```

### Run Tests Matching a Pattern

```bash
pnpm run test --grep "should update user profile"
```

### Run Only Integration Tests

```bash
pnpm run test test/integration/
```

### Run Only Unit Tests

```bash
pnpm run test test/unit/
```

## Vitest CLI Options

### Run Tests with Coverage

```bash
pnpm run test --coverage
```

Generates a coverage report showing which lines are tested.

### Run a Single Test

Use `.only` in the test file:

```typescript
it.only('should run only this test', async () => {
  // test code
});
```

**Warning**: Don't commit `.only`—it will skip other tests in CI.

### Skip a Test

Use `.skip` to temporarily disable a test:

```typescript
it.skip('should skip this test', async () => {
  // test code
});
```

### Run Failed Tests

```bash
pnpm run test --reporter=verbose --reporter=junit --outputFile=test-results.xml
```

## Test Configuration

The test configuration is defined in `apps/server/vitest.config.ts`.

### Two Test Projects

The config defines two separate projects:

1. **Unit Tests**:
   - Runs tests in `test/unit/**/*.test.ts`
   - Isolated test execution
   - No database setup
   - Faster execution

2. **Integration Tests**:
   - Runs tests in `test/integration/**/*.test.ts` and `test/**/*.test.ts`
   - Shared database via MongoDB Memory Server
   - Single-threaded execution for stability
   - Longer timeout (10 seconds)

### Environment Variables

Tests run with these environment variables (from `vitest.config.ts`):

```typescript
NODE_ENV=test
BETTER_AUTH_SECRET=test-secret
BETTER_AUTH_URL=http://localhost:3000/auth
MONGO_USER=username
MONGO_PASSWORD=password
MONGO_DATABASE_NAME=startername-test
LOG_LEVEL=error
```

## Debugging Tests

### Using Console Logs

```typescript
it('should debug this test', async () => {
  console.log('Debug value:', someValue);
  expect(someValue).toBe('expected');
});
```

Logs will appear in the terminal output.

### Using VS Code Debugger

1. Add a breakpoint in your test file
2. Open the test file
3. Press `F5` or use Debug panel
4. Select "Vitest" configuration

### Inspect Test Database

During test development, you can inspect the MongoDB Memory Server:

```typescript
it('should check database state', async () => {
  const { ctx, user } = await createUser();

  // Add breakpoint here and inspect database
  const profile = await UserProfileModel.findOne({ userId: user.id });
  console.log('Profile:', profile);
});
```

## Performance Tips

### Run Integration Tests Single-Threaded

Integration tests already run single-threaded for stability. This is configured in `vitest.config.ts`:

```typescript
poolOptions: {
  threads: {
    singleThread: true,
  },
}
```

### Fast Database Cleanup

The test setup uses `deleteMany()` instead of `dropDatabase()` for faster cleanup:

```typescript
// test/helpers/setup.ts
afterEach(async () => {
  const collections = mongoose.connection.collections;
  await Promise.all(
    Object.values(collections).map((collection) => collection.deleteMany({}))
  );
});
```

### Isolate Unit Tests

Unit tests run in isolation by default, which makes them faster:

```typescript
// vitest.config.ts (unit test project)
isolate: true,
```

## Continuous Integration

Tests run automatically in CI/CD pipelines. The monorepo uses quality gates:

```bash
pnpm run check-types  # Type checking
pnpm run lint         # Linting
pnpm run test         # All tests
```

Run these locally before pushing to catch issues early.

## Common Test Commands Summary

| Command | Description |
|---------|-------------|
| `pnpm run test` | Run all tests once |
| `pnpm run test:watch` | Watch mode (re-run on changes) |
| `pnpm run test:ui` | Visual test runner in browser |
| `pnpm run test <file>` | Run specific test file |
| `pnpm run test --grep <pattern>` | Run tests matching pattern |
| `pnpm run test --coverage` | Run with coverage report |

## Troubleshooting Test Runs

### Tests Hang or Timeout

**Symptoms**: Tests don't complete, timeout errors

**Common causes**:
1. Unclosed database connections
2. Background processes not stopping
3. Infinite loops in code

**Solution**:
- Check for open connections
- Ensure proper cleanup in `afterEach`
- Add `testTimeout: 10000` in config (already set)

### Database Connection Issues

**Symptoms**: `MONGO_URI was not provided`, connection errors

**Common causes**:
1. MongoDB Memory Server not starting
2. Environment variables not set

**Solution**:
- Check `test/global-setup.ts` is running
- Verify `MONGO_URI` is provided by global setup
- Restart test runner

### Import Errors

**Symptoms**: `Cannot find module`, import errors

**Common causes**:
1. Incorrect path alias
2. Missing dependency
3. Circular dependency

**Solution**:
- Verify `@~/` alias resolves correctly
- Check imports match exports
- See [common-issues.md](common-issues.md) for "accessed before declaration"

### Flaky Tests

**Symptoms**: Tests pass/fail randomly

**Common causes**:
1. Race conditions
2. Shared state between tests
3. Timing dependencies

**Solution**:
- Use proper async/await
- Ensure test isolation
- Avoid `setTimeout` in tests
- Check database cleanup is working

## Best Practices

1. **Run tests before committing** - Catch issues early
2. **Use watch mode during development** - Fast feedback
3. **Run full suite before pushing** - Ensure nothing broke
4. **Check coverage occasionally** - Identify untested code
5. **Keep tests fast** - Slow tests discourage running them
6. **Fix flaky tests immediately** - They erode confidence
