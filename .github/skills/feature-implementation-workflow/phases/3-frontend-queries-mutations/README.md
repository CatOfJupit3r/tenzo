---
name: feature-frontend-queries-mutations
description: Phase 3 of full-stack feature development - create TanStack Query hooks for data fetching and mutations. Use after backend endpoints are ready, or when building frontend data layer with queries and mutations.
---

# Phase 3: Frontend Queries & Mutations

Create TanStack Query hooks that connect your frontend to the backend contract.

## Prerequisites

- Completed Phase 2: Backend Implementation
- Backend endpoints are working
- Backend types are exported from contract

## Step 1: Create Query Hooks

Use the **tanstack-query-integration** skill. Query hooks manage server state fetching:

```typescript
// apps/web/src/features/feature/hooks/queries/use-feature.ts
import { useQuery } from '@tanstack/react-query';
import { tanstackRPC } from '@~/utils/tanstack-orpc';
import type { ORPCOutputs } from '@~/utils/orpc';

export const featureQueryOptions = (id: string) =>
  tanstackRPC.feature.getFeature.queryOptions({
    input: { id },
  });

export type FeatureQueryReturnType = ORPCOutputs['feature']['getFeature'];

export function useFeature(id: string) {
  return useQuery(featureQueryOptions(id));
}
```

## Step 2: Create Mutation Hooks

Mutation hooks handle write operations with automatic cache invalidation:

```typescript
// apps/web/src/features/feature/hooks/mutations/use-create-feature.ts
import { useMutation } from '@tanstack/react-query';
import { tanstackRPC } from '@~/utils/tanstack-orpc';

export const createFeatureMutationOptions = tanstackRPC.feature.createFeature.mutationOptions({
  onSuccess: (_data, _variables, _context, ctx) => {
    // Invalidate feature list or related queries
    void ctx.client.invalidateQueries({
      queryKey: tanstackRPC.feature.getFeature.queryKey(),
    });
  },
});

export function useCreateFeature() {
  const { mutate: createFeature, isPending } = useMutation(createFeatureMutationOptions);

  return {
    createFeature,
    isPending,
  };
}
```

## Step 3: Export from Feature Module

```typescript
// apps/web/src/features/feature/index.ts
export { useFeature } from './hooks/queries/use-feature';
export { useCreateFeature } from './hooks/mutations/use-create-feature';
export type { FeatureQueryReturnType } from './hooks/queries/use-feature';
```

## Key Checkpoints

- [ ] Query hooks use correct input/output types from contract
- [ ] Mutation hooks invalidate appropriate cache keys
- [ ] Hooks are properly exported from feature module
- [ ] No hardcoded strings for query keys
- [ ] Type-checking passes: `pnpm run check-types`

## Tips

**Query Options Pattern**: Use the `queryOptions` function to extract query logic for:
- Reuse across multiple hooks
- Server-side preloading (see Phase 4)
- Better cache key management

**Mutation Invalidation**: Always invalidate related queries after mutations to keep data fresh. Use specific query keys, not broad invalidation.

## Next Phase

Proceed to **Phase 4: Frontend Components** when hooks are working and typing correctly.

See also:
- `references/hooks-patterns.md` for advanced hook patterns
- `references/cache-invalidation.md` for cache management strategies
- Full example in `examples/use-feature.ts`

