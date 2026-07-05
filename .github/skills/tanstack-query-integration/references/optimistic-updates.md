# Optimistic Updates

Reference for implementing optimistic updates with TanStack Query. These patterns make your UI feel instant by updating immediately while mutations are in-flight.

## Pattern 1: Single Item Update

Update a single field on an existing item:

```typescript
onMutate: async ({ params: { itemId, newValue } }, ctx) => {
  const key = tanstackRPC.items.getItem.queryKey({ input: { itemId } });
  
  await ctx.client.cancelQueries({ queryKey: key });
  const previous = ctx.client.getQueryData<ItemReturnType>(key);
  
  ctx.client.setQueryData<ItemReturnType>(key, (current) =>
    current ? { ...current, value: newValue } : current
  );
  
  return { previous };
},
```

**Use for:**
- Editing item name
- Toggling item status
- Updating single field

---

## Pattern 2: Remove Item from List

Remove an item from a collection:

```typescript
onMutate: async ({ params: { listId, itemId } }, ctx) => {
  const key = tanstackRPC.lists.getList.queryKey({ input: { listId } });
  
  await ctx.client.cancelQueries({ queryKey: key });
  const previous = ctx.client.getQueryData<ListReturnType>(key);
  
  ctx.client.setQueryData<ListReturnType>(key, (current) => {
    if (!current) return current;
    return {
      ...current,
      items: current.items.filter((item) => item.id !== itemId),
    };
  });
  
  return { previous };
},
```

**Use for:**
- Delete item from list
- Remove user from group
- Dequeue task

---

## Pattern 3: Add Item to List

Add a new item to a collection:

```typescript
onMutate: async ({ params: { listId, newItem } }, ctx) => {
  const key = tanstackRPC.lists.getList.queryKey({ input: { listId } });
  
  await ctx.client.cancelQueries({ queryKey: key });
  const previous = ctx.client.getQueryData<ListReturnType>(key);
  
  ctx.client.setQueryData<ListReturnType>(key, (current) => {
    if (!current) return current;
    return {
      ...current,
      items: [...current.items, newItem],
    };
  });
  
  return { previous };
},
```

**Use for:**
- Create new item in list
- Add user to group
- Queue new task

---

## Pattern 4: Nested Array Update

Update an item within a nested array:

```typescript
onMutate: async ({ params: { parentId, childId, updates } }, ctx) => {
  const key = tanstackRPC.parent.getParent.queryKey({ input: { parentId } });
  
  await ctx.client.cancelQueries({ queryKey: key });
  const previous = ctx.client.getQueryData<ParentReturnType>(key);
  
  ctx.client.setQueryData<ParentReturnType>(key, (current) => {
    if (!current) return current;
    return {
      ...current,
      children: current.children.map((child) =>
        child.id === childId ? { ...child, ...updates } : child
      ),
    };
  });
  
  return { previous };
},
```

**Use for:**
- Edit nested item details
- Update settings in nested object
- Modify step in workflow

---

## Common Structure

All optimistic updates follow this pattern:

```typescript
onMutate: async (params, ctx) => {
  // 1. Get the query key
  const key = tanstackRPC...getQueryKey({ input: { ...} });
  
  // 2. Cancel in-flight queries
  await ctx.client.cancelQueries({ queryKey: key });
  
  // 3. Snapshot previous data
  const previous = ctx.client.getQueryData(key);
  
  // 4. Apply optimistic update
  ctx.client.setQueryData(key, (current) => {
    // Transform current data
    return updated;
  });
  
  // 5. Return for rollback
  return { previous };
},

onError: (_error, params, context, ctx) => {
  // Rollback on error
  const key = tanstackRPC...getQueryKey({ input: { ...} });
  if (context?.previous) {
    ctx.client.setQueryData(key, context.previous);
  } else {
    void ctx.client.invalidateQueries({ queryKey: key });
  }
},

onSuccess: (data, params, _context, ctx) => {
  // Update with server response
  const key = tanstackRPC...getQueryKey({ input: { ...} });
  ctx.client.setQueryData(key, data);
},
```

---

## Handling Undefined Cache

Always check if cache exists before updating:

```typescript
ctx.client.setQueryData(key, (oldData) => {
  if (!oldData) return oldData;  // ← Important: return if undefined
  return { ...oldData, updated: true };
});
```

This prevents errors when the query hasn't been fetched yet.

