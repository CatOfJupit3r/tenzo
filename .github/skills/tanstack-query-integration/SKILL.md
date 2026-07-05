---
name: tanstack-query-integration
description: Integrate TanStack Query with oRPC for data fetching, mutations, and optimistic updates. Divided into focused reference guides for queries, mutations, caching, and best practices. Use when creating query hooks, managing mutations, optimistic updates, cache invalidation, or integrating with route loaders.
---

# TanStack Query Integration

Modular guides for integrating TanStack Query with oRPC for type-safe, performant data fetching and state management.

## Core Concepts

The web app uses `tanstackRPC` (from `@~/utils/tanstack-orpc.ts`) which applies `createTanstackQueryUtils` to the oRPC client. Every contract procedure gets:
- `.queryOptions()` - Query configuration
- `.mutationOptions()` - Mutation configuration
- `.queryKey()` - Type-safe query key generation
- `.call()` - Direct procedure call

## Quick Reference

| Guide | Use When |
|-------|----------|
| [Query Hooks](references/query-hooks.md) | Creating hooks for data fetching, exporting query options |
| [Mutation Hooks](references/mutation-hooks.md) | Implementing mutations with cache invalidation |
| [Optimistic Updates](references/optimistic-updates.md) | Making UI instant with optimistic cache updates |
| [Cache Invalidation](references/cache-invalidation.md) | Keeping data fresh after mutations |
| [Route Integration](references/route-integration.md) | Prefetching data in route loaders |
| [Loading States](references/loading-states.md) | Handling loading, error, and empty states |
| [Best Practices](references/best-practices.md) | 10 critical best practices to follow |

## Learning Path

**Beginner:** Start with Query Hooks → Mutation Hooks → Loading States  
**Intermediate:** Add Optimistic Updates → Cache Invalidation  
**Advanced:** Route Integration → Best Practices

## See Also

- **examples/complete-hooks.ts** - Full working examples
