# Query Hooks

Reference for creating and exporting TanStack Query hooks with oRPC integration.

## Basic Query Hook

```typescript
import { useQuery } from '@tanstack/react-query';
import { tanstackRPC } from '@~/utils/tanstack-orpc';

export function useUserProfile(userId: string) {
  return useQuery(
    tanstackRPC.user.getUserProfile.queryOptions({
      input: { userId },
    })
  );
}
```

The `queryOptions()` method generates proper query key and integration with tanstackRPC.

## Export Query Options for Reuse

Always export query options separately so they can be reused in:
- Route loaders (prefetch data)
- Other mutations (cache invalidation)
- Component tests

```typescript
import { useQuery } from '@tanstack/react-query';
import { tanstackRPC } from '@~/utils/tanstack-orpc';
import type { ORPCOutputs } from '@~/utils/orpc';

// Export the query options (can be used in route loaders)
export const userProfileQueryOptions = (userId: string) =>
  tanstackRPC.user.getUserProfile.queryOptions({
    input: { userId },
  });

// Export return type for type-safe mutations
export type UserProfileQueryReturnType = ORPCOutputs['user']['getUserProfile'];

// Export the hook
export function useUserProfile(userId: string) {
  return useQuery(userProfileQueryOptions(userId));
}
```

## Conditional Queries

Use `enabled` option to conditionally disable queries when dependencies aren't available:

```typescript
export function useUserProfile(userId: string | undefined) {
  return useQuery(
    tanstackRPC.user.getUserProfile.queryOptions({
      input: { userId: userId! },
      enabled: !!userId, // Query only runs when userId is defined
    })
  );
}
```

**Use cases:**
- Don't query until user ID is available
- Skip queries on certain conditions
- Wait for dependent data before fetching

## Query State Handling

Every query hook returns the full query state:

```typescript
const { 
  data,           // The query result (type-safe from contract)
  isPending,      // Initially loading or loading again
  isLoading,      // Initially loading (different from isPending)
  isFetching,     // Any fetching in progress
  error,          // Error object if query failed
  status,         // 'pending' | 'error' | 'success'
  dataUpdatedAt,  // Timestamp of last successful update
} = useUserProfile(userId);
```

