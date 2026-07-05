---
name: feature-testing-polish
description: Phase 5 of full-stack feature development - add tests, verify access control, and perform quality checks. Use after all implementation phases are complete, or when finalizing and validating a feature before deployment.
---

# Phase 5: Testing & Polish

Ensure your feature is well-tested, secure, and production-ready.

## Prerequisites

- Completed Phase 4: Frontend Components & Integration
- All previous phases type-check
- Feature is functional end-to-end

## Step 1: Write Backend Integration Tests

```typescript
// apps/server/test/integration/feature.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { testClient, setupTestDB } from '../helpers/test-utils';

describe('Feature API Integration', () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  it('should create and retrieve a feature', async () => {
    const created = await testClient.feature.createFeature({
      params: { name: 'Integration Test' },
    });

    expect(created.name).toBe('Integration Test');

    const retrieved = await testClient.feature.getFeature({
      params: { id: created._id },
    });

    expect(retrieved).toMatchObject(created);
  });

  it('should prevent unauthorized access', async () => {
    const feature = await createFeatureAsUser(userA);
    
    await expect(
      testClientForUser(userB).feature.getFeature({
        params: { id: feature._id },
      })
    ).rejects.toThrow('FEATURE_NOT_FOUND');
  });
});
```

## Step 2: Write Frontend Component Tests

```typescript
// apps/web/test/features/feature-card.test.tsx
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FeatureCard } from '@~/features/feature/components/feature-card';
import { vi } from 'vitest';

describe('FeatureCard', () => {
  it('should display feature data', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    vi.mock('@~/features/feature/hooks/queries/use-feature', () => ({
      useFeature: () => ({
        data: {
          _id: '123',
          name: 'Test Feature',
          ownerId: 'user-1',
        },
        isPending: false,
        error: null,
      }),
    }));

    render(
      <QueryClientProvider client={queryClient}>
        <FeatureCard id="123" />
      </QueryClientProvider>
    );

    expect(screen.getByText('Test Feature')).toBeInTheDocument();
  });

  it('should show loading skeleton', () => {
    // Mock loading state...
    render(<FeatureCard id="123" />);
    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });
});
```

## Step 3: Verify Access Control

✓ **Test authorization at router level:**

```typescript
// apps/server/test/features/feature.test.ts
describe('Feature Access Control', () => {
  it('should only allow owner to access feature', async () => {
    const feature = await FeatureModel.create({
      _id: ObjectIdString(),
      name: 'Private Feature',
      ownerId: userA._id,
    });

    // User A should access
    const result = await testClientForUser(userA)
      .feature.getFeature({ params: { id: feature._id } });
    expect(result).toBeDefined();

    // User B should NOT access
    await expect(
      testClientForUser(userB).feature.getFeature({ params: { id: feature._id } })
    ).rejects.toThrow('FEATURE_NOT_FOUND');
  });
});
```

✓ **Verify error codes are defined and used correctly:**

```typescript
// Check all throws use defined error codes
// GOOD:
throw ORPCNotFoundError(ERROR_CODES.FEATURE_NOT_FOUND);
throw ORPCForbiddenError(ERROR_CODES.INSUFFICIENT_PERMISSIONS);

// BAD - avoid hardcoded strings:
// throw new Error('Feature not found');
// throw ORPCNotFoundError('FEATURE_NOT_FOUND');
```

## Step 4: Run Quality Checks

```bash
# Type checking
pnpm run check-types

# Linting and formatting
pnpm run lint
pnpm run prettier

# Run all tests
pnpm run test

# (Optional) Full validation
pnpm run check-types && pnpm run lint && pnpm run prettier && pnpm run test
```

## Step 5: Verification Checklist

**Backend:**
- [ ] All contract routes implemented
- [ ] Error handling uses defined error codes
- [ ] Access control prevents unauthorized access
- [ ] Tests cover happy path and error cases
- [ ] Type-checking passes

**Frontend:**
- [ ] Components handle all states (loading, error, success, empty)
- [ ] Hooks properly invalidate cache on mutations
- [ ] Routes preload data when appropriate
- [ ] Forms validate input
- [ ] Tests cover user interactions

**Quality:**
- [ ] `pnpm run check-types` passes
- [ ] `pnpm run lint` passes (no errors)
- [ ] `pnpm run prettier` passes (formatting correct)
- [ ] `pnpm run test` passes (all tests pass)
- [ ] No `// @ts-ignore` comments (unless documented)
- [ ] Shared constants use enums (not hardcoded strings)

## Performance Considerations

Review `react-component-patterns` skill for:
- ✓ Bundle optimization if adding heavy components
- ✓ Waterfall elimination if adding data fetching
- ✓ Re-render optimization if components render frequently
- ✓ Server-side performance if adding heavy computations

## Key Checkpoints

- [ ] Integration tests pass
- [ ] Component tests pass
- [ ] Access control verified
- [ ] All quality checks pass
- [ ] No console warnings or errors
- [ ] Feature is ready for code review

## Summary

Congratulations! You've completed all phases:

1. ✓ **Phase 1**: Foundation (Models & Contracts)
2. ✓ **Phase 2**: Backend Implementation
3. ✓ **Phase 3**: Frontend Queries & Mutations
4. ✓ **Phase 4**: Frontend Components & Integration
5. ✓ **Phase 5**: Testing & Polish

Your feature is now complete and ready for review/deployment.

See also:
- `references/testing-checklist.md` for comprehensive testing guide
- `references/access-control-patterns.md` for authorization best practices
- Full example in `examples/feature.integration.test.ts`

