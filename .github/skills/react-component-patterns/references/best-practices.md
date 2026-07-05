# Component Organization and Best Practices

Guidelines for organizing React code and building maintainable components.

## Feature-based structure

Organize code by feature/domain rather than file type:

```
apps/web/src/features/
├── challenges/
│   ├── components/
│   │   ├── challenge-card.tsx
│   │   ├── challenge-list.tsx
│   │   ├── challenge-form.tsx
│   │   └── index.ts
│   ├── hooks/
│   │   ├── queries/
│   │   │   └── use-challenge.ts
│   │   └── mutations/
│   │       ├── use-create-challenge.ts
│   │       └── use-update-challenge.ts
│   └── index.ts  # Public API exports
├── user-profile/
│   ├── components/
│   ├── hooks/
│   └── index.ts
└── ...
```

## Exporting from feature modules

Create a single entry point for each feature:

```typescript
// apps/web/src/features/challenges/index.ts
export { ChallengeCard } from './components/challenge-card';
export { ChallengeList } from './components/challenge-list';
export { ChallengeForm } from './components/challenge-form';

export { useChallenge } from './hooks/queries/use-challenge';
export { useChallenges } from './hooks/queries/use-challenges';
export { useCreateChallenge } from './hooks/mutations/use-create-challenge';
export { useUpdateChallenge } from './hooks/mutations/use-update-challenge';

export type { Challenge } from './types';
```

Usage:
```typescript
import { ChallengeCard, useChallenge } from '@~/features/challenges';
```

## Component file naming

```typescript
// File: user-profile-card.tsx (kebab-case)
export function UserProfileCard() { // PascalCase for component
  // ...
}

// File: use-user-profile.ts
export function useUserProfile() { // camelCase for hooks
  // ...
}
```

## Component composition structure

```typescript
import type React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle } from '@~/components/ui/card';

// Props type
type UserCardProps = {
  userId: string;
  onEdit?: () => void;
};

// Component
export function UserCard({ userId, onEdit }: UserCardProps) {
  const { data: user, isPending } = useUserProfile(userId);

  if (isPending) return <CardSkeleton />;
  if (!user) return <Empty>User not found</Empty>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{user.name}</CardTitle>
      </CardHeader>
      {/* Content */}
    </Card>
  );
}

// Sub-components if needed
function CardSkeleton() {
  return <Skeleton className="h-32 w-full" />;
}
```

## Avoid prop drilling

❌ **Don't**: Pass props through intermediate components
```typescript
function Parent({ data }: Props) {
  return <Child data={data} />;
}

function Child({ data }: Props) {
  return <GrandChild data={data} />;
}

function GrandChild({ data }: Props) {
  return <div>{data.value}</div>;
}
```

✅ **Do**: Use custom hooks or context at the component level
```typescript
// Create a hook that encapsulates the data fetching
export function useFeatureData() {
  return useQuery(/* ... */);
}

// Each component uses the hook
function GrandChild() {
  const { data } = useFeatureData();
  return <div>{data.value}</div>;
}
```

## Keep components focused

❌ **Don't**: Create large multi-purpose components
```typescript
function MegaComponent({ type }: { type: 'card' | 'list' | 'grid' }) {
  if (type === 'card') return <CardView />;
  if (type === 'list') return <ListView />;
  return <GridView />;
}
```

✅ **Do**: Create focused, single-purpose components
```typescript
export function FeatureCard() {
  // Only card logic
}

export function FeatureList() {
  // Only list logic
}

export function FeatureGrid() {
  // Only grid logic
}
```

## Prefer composition over configuration

❌ **Don't**: Create components with many props for configuration
```typescript
<Button
  variant="primary"
  size="large"
  icon="check"
  iconPosition="left"
  loading={false}
  disabled={false}
/>
```

✅ **Do**: Use composition with simpler components
```typescript
<Button size="lg">
  <Check className="mr-2 h-4 w-4" />
  Confirm
</Button>
```

## Component with multiple states

```typescript
type UserListProps = {
  userId: string;
};

export function UserList({ userId }: UserListProps) {
  const { data, isPending, error } = useUserList(userId);

  // Loading state
  if (isPending) {
    return <ListSkeleton count={5} />;
  }

  // Error state
  if (error) {
    return <ErrorDisplay error={error} onRetry={() => refetch()} />;
  }

  // Empty state
  if (!data?.length) {
    return (
      <Empty>
        <EmptyHeader>No items</EmptyHeader>
        <EmptyDescription>Create your first item to get started</EmptyDescription>
      </Empty>
    );
  }

  // Success state
  return (
    <div className="space-y-2">
      {data.map((item) => (
        <UserListItem key={item.id} item={item} />
      ))}
    </div>
  );
}
```

## Type-safe props

```typescript
import type { ReactNode } from 'react';

type ButtonProps = {
  children: ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
  className?: string;
};

export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  loading = false,
  className = '',
}: ButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'px-4 py-2 rounded font-medium',
        variant === 'primary' && 'bg-primary text-primary-foreground',
        variant === 'secondary' && 'bg-secondary text-secondary-foreground',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {loading ? 'Loading...' : children}
    </button>
  );
}
```

## Extracting static JSX

If you have static JSX that doesn't change, move it outside:

```typescript
// Bad - function recreated on every render
function Component() {
  const staticContent = (
    <div>
      <h1>Title</h1>
      <p>Description</p>
    </div>
  );

  return <div>{staticContent}</div>;
}

// Good - defined once
const STATIC_CONTENT = (
  <div>
    <h1>Title</h1>
    <p>Description</p>
  </div>
);

function Component() {
  return <div>{STATIC_CONTENT}</div>;
}
```

## Memoization when appropriate

Use `React.memo` for expensive components that receive many props:

```typescript
// Only memo if component is expensive and receives many props
type UserCardProps = {
  user: User;
  onEdit: () => void;
  onDelete: () => void;
  // ... many more props
};

export const UserCard = React.memo(function UserCard({
  user,
  onEdit,
  onDelete,
}: UserCardProps) {
  return <div>{/* Expensive render */}</div>;
});
```

Don't over-use memo - benchmark first to confirm it helps.

## Best practices summary

1. **Organize by feature, not file type**
2. **Keep components focused and single-purpose**
3. **Use composition instead of configuration**
4. **Avoid prop drilling with custom hooks**
5. **Extract complex state logic to custom hooks**
6. **Use TypeScript for type safety**
7. **Create a single entry point for each feature**
8. **Memo only expensive components**
9. **Keep components testable**
10. **Document complex components with JSDoc**
