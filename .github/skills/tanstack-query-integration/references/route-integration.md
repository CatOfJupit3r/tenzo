# Route Integration

Reference for integrating TanStack Query with TanStack Router loaders and context.

## Prefetch Data in Route Loaders

Load data before rendering to eliminate loading states:

```typescript
import { createFileRoute } from '@tanstack/react-router';
import { userProfileQueryOptions } from '@~/features/user/hooks/use-user-profile';

export const Route = createFileRoute('/profile/$userId')({
  async loader({ context, params }) {
    // Prefetch data before component renders
    await context.queryClient.ensureQueryData(
      userProfileQueryOptions(params.userId)
    );
  },
  component: ProfilePage,
});

function ProfilePage() {
  const { userId } = Route.useParams();
  const { data: profile } = useUserProfile(userId);
  
  // Data is already cached, no loading state!
  return <ProfileDisplay profile={profile} />;
}
```

**Benefits:**
- ✓ No loading skeleton
- ✓ Instant page display
- ✓ Better UX
- ✓ SEO-friendly (server-side compatible)

---

## Access QueryClient from Route Context

Get queryClient and tanstackRPC from route context:

```typescript
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
});

function DashboardPage() {
  const { queryClient, tanstackRPC } = Route.useRouteContext();
  
  // Use queryClient
  const data = queryClient.getQueryData(['user', 'profile']);
  
  // Or use tanstackRPC for additional queries
  const result = await tanstackRPC.user.getUserProfile.call({ input: { userId: '123' } });
  
  return <div>Dashboard</div>;
}
```

---

## Prefetch Multiple Related Queries

Load multiple interdependent queries:

```typescript
export const Route = createFileRoute('/project/$projectId')({
  async loader({ context, params }) {
    // Prefetch project details
    await context.queryClient.ensureQueryData(
      projectDetailsQueryOptions(params.projectId)
    );
    
    // Prefetch project members
    await context.queryClient.ensureQueryData(
      projectMembersQueryOptions(params.projectId)
    );
    
    // Prefetch project settings
    await context.queryClient.ensureQueryData(
      projectSettingsQueryOptions(params.projectId)
    );
  },
  component: ProjectPage,
});
```

---

## Conditional Prefetching

Only prefetch under certain conditions:

```typescript
export const Route = createFileRoute('/challenges/:challengeId')({
  async loader({ context, params }) {
    const { challengeId } = params;
    
    // Prefetch challenge details
    await context.queryClient.ensureQueryData(
      challengeDetailsQueryOptions(challengeId)
    );
    
    // Only prefetch steps if in edit mode
    const isEditMode = new URL(location.href).searchParams.get('edit') === 'true';
    if (isEditMode) {
      await context.queryClient.ensureQueryData(
        challengeStepsQueryOptions(challengeId)
      );
    }
  },
  component: ChallengePage,
});
```

---

## Error Handling in Loaders

Handle prefetch errors gracefully:

```typescript
export const Route = createFileRoute('/profile/$userId')({
  async loader({ context, params }) {
    try {
      await context.queryClient.ensureQueryData(
        userProfileQueryOptions(params.userId)
      );
    } catch (error) {
      // Log error but don't fail the route
      console.error('Failed to prefetch profile:', error);
      // Route will still render, component shows error state
    }
  },
  component: ProfilePage,
});
```

---

## Best Practices

**✓ Do:**
- Export query options separately (for reuse in loaders)
- Prefetch in loaders for critical data
- Use `ensureQueryData` to avoid duplicate requests
- Handle loader errors gracefully

**✗ Don't:**
- Fetch in component if should be in loader
- Create query options inline
- Ignore prefetch errors (they prevent navigation)

---

## Performance Tips

1. **Prefetch only critical data**
   - Prefetch items needed immediately
   - Lazy-load secondary data

2. **Parallel prefetching**
   - `await Promise.all([...])` for independent queries

3. **Cache duration**
   - Stale data will refetch on component mount
   - Use with caution for real-time data

