# Loading and Error States

Reference for handling loading, error, and empty states in components.

## Basic Component Pattern

```typescript
function UserProfile({ userId }: { userId: string }) {
  const { data: profile, isPending, error } = useUserProfile(userId);

  // Show loading skeleton
  if (isPending) {
    return <Skeleton className="h-20 w-full" />;
  }

  // Show error state
  if (error) {
    return <Alert variant="destructive">{error.message}</Alert>;
  }

  // Show empty state
  if (!profile) {
    return <Empty>Profile not found</Empty>;
  }

  // Show content
  return <ProfileDisplay profile={profile} />;
}
```

**Order matters:**
1. Check `isPending` first
2. Check `error` next
3. Check for empty data
4. Render content

---

## Extended State Handling

Handle more granular states:

```typescript
function UserProfile({ userId }: { userId: string }) {
  const { data, isPending, isLoading, isFetching, error, status } = useUserProfile(userId);

  // Initially loading (no cached data)
  if (isLoading) {
    return <SkeletonLarge />;
  }

  // Refetching in background (has cached data)
  if (isFetching && !isLoading && data) {
    return <ProfileDisplay profile={data} isRefreshing={true} />;
  }

  // Error
  if (error) {
    return <Alert variant="destructive">{error.message}</Alert>;
  }

  // Content
  return <ProfileDisplay profile={data} />;
}
```

**State differences:**
- `isPending`: Any loading (initial or refetch)
- `isLoading`: Initial load only
- `isFetching`: Any fetch in progress
- `status`: 'pending' | 'error' | 'success'

---

## Using PseudoPage for Route-Level Loading

For full-page data loading:

```typescript
import { PseudoPage } from '@~/components/pseudo-page';

function DashboardPage() {
  const { data, isPending, error } = useDashboard();

  // Full-page loading skeleton
  if (isPending) return <PseudoPage />;

  // Full-page error
  if (error) return <ErrorDisplay error={error} />;

  // Content
  return <Dashboard data={data} />;
}
```

`PseudoPage` shows a realistic skeleton of the page content while loading.

---

## Error Display Best Practices

### User-Friendly Errors

```typescript
function ErrorDisplay({ error }: { error: Error }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Something went wrong</AlertTitle>
      <AlertDescription>
        {error.message || 'Please try again later'}
      </AlertDescription>
      <Button onClick={() => window.location.reload()}>
        Try again
      </Button>
    </Alert>
  );
}
```

### Dev-Friendly Errors (Development Only)

```typescript
function ErrorDisplay({ error }: { error: Error }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>
        {error.message}
      </AlertDescription>
      {process.env.NODE_ENV === 'development' && (
        <pre className="mt-2 text-xs overflow-auto">
          {error.stack}
        </pre>
      )}
    </Alert>
  );
}
```

---

## Empty State Pattern

```typescript
function ItemList() {
  const { data: items, isPending, error } = useItems();

  if (isPending) return <Skeleton />;
  if (error) return <ErrorDisplay error={error} />;

  // Empty state
  if (!items || items.length === 0) {
    return (
      <Empty>
        <EmptyIcon />
        <p>No items yet</p>
        <Button>Create first item</Button>
      </Empty>
    );
  }

  return (
    <ul>
      {items.map((item) => (
        <li key={item.id}>{item.name}</li>
      ))}
    </ul>
  );
}
```

---

## Retry Logic

Let TanStack Query handle retries automatically:

```typescript
function UserProfile({ userId }: { userId: string }) {
  const { data, isPending, error } = useUserProfile(userId);
  
  // TanStack Query retries failed queries automatically
  // Default: 3 retries with exponential backoff
  // Error only shows after all retries exhausted

  if (isPending) return <Skeleton />;
  if (error) return <Alert>Failed to load profile</Alert>;
  return <ProfileDisplay profile={data} />;
}
```

For custom retry logic, configure in `useQuery()`:

```typescript
useQuery({
  ...queryOptions,
  retry: 5,        // Retry up to 5 times
  retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
});
```

---

## Skeleton vs Spinner

**Use Skeleton:**
- ✓ Known layout structure
- ✓ Better perceived performance
- ✓ Prevents layout shift

**Use Spinner:**
- ✓ Dynamic/unknown layout
- ✓ Full-page loading
- ✓ Simple loading state

