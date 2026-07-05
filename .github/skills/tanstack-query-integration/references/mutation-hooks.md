# Mutation Hooks

Reference for creating mutation hooks with TanStack Query and oRPC.

## Basic Mutation

```typescript
import { useMutation } from '@tanstack/react-query';
import { tanstackRPC } from '@~/utils/tanstack-orpc';

export const updateUserProfileMutationOptions = tanstackRPC.user.updateUserProfile.mutationOptions({
  onSuccess: (_data, _variables, _context, ctx) => {
    // Invalidate related queries after mutation succeeds
    void ctx.client.invalidateQueries({
      queryKey: tanstackRPC.user.getUserProfile.queryKey(),
    });
  },
  onError: (error) => {
    console.error('Failed to update profile:', error);
  },
});

export function useUpdateUserProfile() {
  const { mutate: updateProfile, isPending } = useMutation(updateUserProfileMutationOptions);

  return {
    updateProfile,
    isPending,
  };
}
```

**Key points:**
- `mutationOptions()` integrates with tanstackRPC
- Use `ctx.client` to invalidate queries (not imported queryClient)
- Return state for UI (isPending, isError, etc.)

## Mutation with Optimistic Updates

For better UX, update UI immediately while mutation is in-flight:

```typescript
import { useMutation } from '@tanstack/react-query';
import { tanstackRPC } from '@~/utils/tanstack-orpc';
import type { UserProfileQueryReturnType } from './use-user-profile';

export const updateUserProfileMutationOptions = tanstackRPC.user.updateUserProfile.mutationOptions({
  async onMutate({ params: { userId, bio } }, ctx) {
    // 1. Cancel in-flight queries
    const key = tanstackRPC.user.getUserProfile.queryKey({ input: { userId } });
    await ctx.client.cancelQueries({ queryKey: key });

    // 2. Snapshot previous data for rollback
    const previous = ctx.client.getQueryData<UserProfileQueryReturnType>(key);

    // 3. Apply optimistic update
    ctx.client.setQueryData<UserProfileQueryReturnType>(key, (oldData) => {
      if (!oldData) return oldData;
      return { ...oldData, bio };
    });

    // 4. Return context for error rollback
    return { previous };
  },

  onError: (_error, { params: { userId } }, context, ctx) => {
    // Rollback on error
    const key = tanstackRPC.user.getUserProfile.queryKey({ input: { userId } });
    if (context?.previous) {
      ctx.client.setQueryData<UserProfileQueryReturnType>(key, context.previous);
    } else {
      void ctx.client.invalidateQueries({ queryKey: key });
    }
  },

  onSuccess: (data, { params: { userId } }, _context, ctx) => {
    // Update with server response
    const key = tanstackRPC.user.getUserProfile.queryKey({ input: { userId } });
    ctx.client.setQueryData<UserProfileQueryReturnType>(key, data);
  },
});

export function useUpdateUserProfile() {
  const { mutate: updateProfile, isPending } = useMutation(updateUserProfileMutationOptions);
  return { updateProfile, isPending };
}
```

**Optimistic update flow:**
1. User submits form
2. `onMutate`: Update UI immediately (show new value)
3. Request sent to server
4. If server responds (onSuccess): Use server response to update cache
5. If error (onError): Rollback to previous state

**See also**: `optimistic-updates.md` for specific update patterns

## Mutation State

Every mutation returns state for UI:

```typescript
const {
  mutate,          // Function to call the mutation
  isPending,       // Mutation is in-flight
  isError,         // Last mutation failed
  error,           // Error object if failed
  data,            // Last mutation result
  status,          // 'idle' | 'pending' | 'error' | 'success'
} = useMutation(mutationOptions);
```

## When to use onSuccess vs onSettled vs invalidate

```typescript
// Use onSuccess when server returns updated data
onSuccess: (data, _variables, _context, ctx) => {
  ctx.client.setQueryData(key, data); // Use server response
},

// Use onSettled when you need to run logic regardless of success/error
onSettled: (_data, _error, _variables, ctx) => {
  void ctx.client.invalidateQueries({ queryKey: key }); // Always refetch
},

// Use invalidate to force refetch from server
onSuccess: (_data, _variables, _context, ctx) => {
  void ctx.client.invalidateQueries({ queryKey: key }); // Refetch
},
```

