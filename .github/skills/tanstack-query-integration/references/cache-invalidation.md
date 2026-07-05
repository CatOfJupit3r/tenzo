# Cache Invalidation

Reference for invalidating cached queries after mutations to keep data fresh.

## Invalidate Specific Query

Invalidate a query with specific parameters:

```typescript
void ctx.client.invalidateQueries({
  queryKey: tanstackRPC.user.getUserProfile.queryKey({ input: { userId } }),
});
```

**Use when:**
- Mutating a specific user's profile
- Need exact cache key match
- Query parameters are well-defined

---

## Invalidate All in Namespace

Invalidate all queries for a procedure regardless of parameters:

```typescript
void ctx.client.invalidateQueries({
  queryKey: tanstackRPC.user.getUserProfile.queryKey(),
});
```

This invalidates queries with ANY userId, not just specific ones.

**Use when:**
- Mutation affects all cached instances
- Don't know exact parameters
- Safer blanket invalidation

---

## Invalidate Multiple Related Queries

Invalidate several queries after a mutation:

```typescript
onSuccess: (_data, { params: { challengeId } }, _context, ctx) => {
  // Invalidate the challenge details
  void ctx.client.invalidateQueries({
    queryKey: tanstackRPC.challenge.getChallengeDetails.queryKey({ 
      input: { challengeId } 
    }),
  });
  
  // Invalidate the challenge list
  void ctx.client.invalidateQueries({
    queryKey: tanstackRPC.challenge.listChallenges.queryKey(),
  });
  
  // Invalidate user's challenges
  void ctx.client.invalidateQueries({
    queryKey: tanstackRPC.user.getUserChallenges.queryKey(),
  });
},
```

**Use when:**
- Mutation affects multiple data sources
- Need to update related queries
- Example: Deleting challenge affects list + user list + details

---

## Invalidation vs setQueryData

**Invalidate (refetch):**
```typescript
void ctx.client.invalidateQueries({ queryKey: key });
// → Marks stale, refetches when component re-renders
// → Slower, but always server-accurate
```

**Set directly (faster):**
```typescript
ctx.client.setQueryData(key, newData);
// → Updates cache immediately
// → Faster, for optimistic updates or known server responses
```

**Choose:**
- Use `setQueryData` for optimistic updates (instant UI)
- Use `setQueryData` with server response in `onSuccess`
- Use `invalidateQueries` for complex mutations
- Use `invalidateQueries` for safety when unsure

---

## Invalidation Timing

### onSuccess
Invalidate after server confirms success:

```typescript
onSuccess: (_data, _variables, _context, ctx) => {
  // Server confirmed, safe to invalidate
  void ctx.client.invalidateQueries({ queryKey: key });
},
```

### onError
Optionally invalidate to ensure correctness:

```typescript
onError: (_error, _variables, context, ctx) => {
  // Rollback optimistic update
  if (context?.previous) {
    ctx.client.setQueryData(key, context.previous);
  } else {
    // If no snapshot, invalidate to refetch
    void ctx.client.invalidateQueries({ queryKey: key });
  }
},
```

---

## Best Practice: Combination Strategy

```typescript
mutationOptions({
  async onMutate(params, ctx) {
    // Optimistic update for instant UI
    // Return snapshot for rollback
  },
  
  onError(_error, params, context, ctx) {
    // Rollback optimistic update
    // Invalidate if no snapshot (safety)
  },
  
  onSuccess(data, params, _context, ctx) {
    // Use server response (most accurate)
    // Update cache with real data
  },
})
```

This combination gives you:
- ✓ Instant UI updates (onMutate)
- ✓ Error recovery (onError)
- ✓ Server-accurate data (onSuccess)

