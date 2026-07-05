# Loading, Error, and Empty States

Guide to handling different UI states in components.

## Component-level loading states

Show loading skeletons while data is being fetched:

```typescript
import { Skeleton } from '@~/components/ui/skeleton';
import { Alert, AlertDescription } from '@~/components/ui/alert';

function UserProfile({ userId }: { userId: string }) {
  const { data: user, isPending, error } = useUserProfile(userId);

  if (isPending) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-4 w-32" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Failed to load profile: {error.message}</AlertDescription>
      </Alert>
    );
  }

  if (!user) {
    return <Empty>User not found</Empty>;
  }

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
}
```

## Skeleton patterns

Create skeletons that match your component layout:

```typescript
// Skeleton for card
<div className="space-y-2">
  <Skeleton className="h-12 w-full" /> {/* Image or header */}
  <Skeleton className="h-6 w-3/4" /> {/* Title */}
  <Skeleton className="h-4 w-full" /> {/* Description line 1 */}
  <Skeleton className="h-4 w-2/3" /> {/* Description line 2 */}
</div>

// Skeleton for list
<div className="space-y-2">
  <Skeleton className="h-16 w-full" /> {/* List item 1 */}
  <Skeleton className="h-16 w-full" /> {/* List item 2 */}
  <Skeleton className="h-16 w-full" /> {/* List item 3 */}
</div>

// Skeleton for table
<div className="space-y-2">
  <div className="flex gap-2">
    <Skeleton className="h-8 flex-1" /> {/* Cell 1 */}
    <Skeleton className="h-8 flex-1" /> {/* Cell 2 */}
    <Skeleton className="h-8 flex-1" /> {/* Cell 3 */}
  </div>
  {/* Repeat for multiple rows */}
</div>
```

## Route-level loading with PseudoPage

For full-page loading states, use PseudoPage component:

```typescript
import { PseudoPage } from '@~/components/pseudo-page';
import { Alert, AlertDescription } from '@~/components/ui/alert';
import { Empty } from '@~/components/ui/empty';

function DashboardPage() {
  const { data, isPending, error } = useDashboard();

  if (isPending) return <PseudoPage />;

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load dashboard. Please try again later.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <Empty>
        <EmptyHeader>No data available</EmptyHeader>
        <EmptyDescription>Start by creating your first item</EmptyDescription>
      </Empty>
    );
  }

  return <Dashboard data={data} />;
}
```

## Empty state component

```typescript
import { Empty, EmptyHeader, EmptyDescription, EmptyContent } from '@~/components/ui/empty';
import { Button } from '@~/components/ui/button';

export function EmptyChallengeList() {
  return (
    <Empty>
      <EmptyHeader>No challenges yet</EmptyHeader>
      <EmptyDescription>
        Create your first challenge to get started with the platform
      </EmptyDescription>
      <EmptyContent>
        <Button onClick={() => navigate('/create-challenge')}>
          Create Challenge
        </Button>
      </EmptyContent>
    </Empty>
  );
}
```

## Error handling patterns

### User-friendly error messages

Always show errors in a way that helps the user understand what happened:

```typescript
// Good - actionable
<Alert variant="destructive">
  <AlertDescription>
    Failed to save changes. Please check your internet connection and try again.
  </AlertDescription>
</Alert>

// Bad - technical jargon
<Alert variant="destructive">
  <AlertDescription>
    Error 502: Bad Gateway - CORS policy violation
  </AlertDescription>
</Alert>
```

### Retry functionality

```typescript
function DataList() {
  const { data, error, refetch, isFetching } = useDataList();

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="flex items-center justify-between">
          <span>Failed to load data</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            {isFetching ? 'Retrying...' : 'Retry'}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return <div>{/* Content */}</div>;
}
```

## Progressive loading

Show content as it becomes available:

```typescript
function ContentPage() {
  const header = useHeader();
  const mainContent = useMainContent();
  const sidebar = useSidebar();

  return (
    <div className="flex gap-4">
      <main className="flex-1">
        {header.isPending ? <Skeleton className="h-12 w-full" /> : <Header data={header.data} />}
        {mainContent.isPending ? <Skeleton className="h-64 w-full" /> : <Main data={mainContent.data} />}
      </main>
      <aside className="w-64">
        {sidebar.isPending ? <Skeleton className="h-96 w-full" /> : <Sidebar data={sidebar.data} />}
      </aside>
    </div>
  );
}
```

## Loading within content

Show loading state for updates without blocking view:

```typescript
function CommentSection({ postId }: { postId: string }) {
  const { data: comments, isPending } = useComments(postId);

  return (
    <div>
      <h2>Comments</h2>
      {isPending ? (
        <Skeleton className="h-48 w-full" />
      ) : comments?.length === 0 ? (
        <p className="text-muted-foreground">No comments yet</p>
      ) : (
        <div className="space-y-2">
          {comments?.map((comment) => (
            <CommentCard key={comment.id} comment={comment} />
          ))}
        </div>
      )}
    </div>
  );
}
```

## Best practices

### Match skeleton to actual content

Make skeletons the same size and shape as the real content so there's no layout shift when content loads.

### Use consistent error styling

Always use the `Alert` component with `variant="destructive"` for errors so users recognize them immediately.

### Never show loading state for cached data

If data is already cached, show it immediately instead of showing a skeleton:

```typescript
// Good - uses cached data when available
const { data, isPending, isLoading } = useQuery({
  queryKey: ['item', id],
  queryFn: fetchItem,
  staleTime: 5 * 60 * 1000, // Cache for 5 minutes
});

// Show skeleton only on first load or when refetching
if (!data && isLoading) return <Skeleton />;
return <ItemDisplay data={data} />;
```

### Provide context for empty states

Don't just say "No items", explain what they should do:

```typescript
// Good
<Empty>
  <EmptyHeader>No projects</EmptyHeader>
  <EmptyDescription>
    You haven't created any projects yet. Start by creating your first project.
  </EmptyDescription>
  <Button onClick={() => navigate('/create')}>Create Project</Button>
</Empty>

// Bad
<Empty>
  <EmptyHeader>Empty</EmptyHeader>
</Empty>
```
