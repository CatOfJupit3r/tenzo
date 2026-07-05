---
name: feature-frontend-components
description: Phase 4 of full-stack feature development - build React components and routes. Use after query/mutation hooks are ready, or when implementing UI components and page layouts for your feature.
---

# Phase 4: Frontend Components & Integration

Build React components that use your query/mutation hooks and integrate them into routes.

## Prerequisites

- Completed Phase 3: Frontend Queries & Mutations
- Hooks are working correctly
- Components are available (card, button, form, etc.)

## Step 1: Create Components

Use the **react-component-patterns** skills.

**Display Component:**
```typescript
// apps/web/src/features/feature/components/feature-card.tsx
import { Card, CardHeader, CardTitle, CardContent } from '@~/components/ui/card';
import { Skeleton } from '@~/components/ui/skeleton';
import { Alert, AlertDescription } from '@~/components/ui/alert';
import { useFeature } from '../hooks/queries/use-feature';

export function FeatureCard({ id }: { id: string }) {
  const { data: feature, isPending, error } = useFeature(id);

  if (isPending) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Failed to load feature</AlertDescription>
      </Alert>
    );
  }

  if (!feature) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{feature.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Owner: {feature.ownerId}
        </p>
      </CardContent>
    </Card>
  );
}
```

**Form Component:**
```typescript
// apps/web/src/features/feature/components/create-feature-form.tsx
import z from 'zod';
import { useAppForm } from '@~/components/ui/field';
import { useCreateFeature } from '../hooks/mutations/use-create-feature';

const featureSchema = z.object({
  name: z.string().min(1, 'Name is required'),
});

export function CreateFeatureForm() {
  const { createFeature, isPending } = useCreateFeature();

  const form = useAppForm({
    defaultValues: { name: '' },
    validators: { onSubmit: featureSchema },
    onSubmit: async ({ value }) => {
      createFeature({ params: value });
    },
  });

  return (
    <form.AppForm>
      <form.Form className="space-y-4">
        <form.AppField name="name">
          {(field) => <field.TextField label="Feature name" />}
        </form.AppField>
        <form.SubmitButton disabled={isPending}>
          {isPending ? 'Creating...' : 'Create Feature'}
        </form.SubmitButton>
      </form.Form>
    </form.AppForm>
  );
}
```

## Step 2: Create Routes

Use TanStack Router for integration with preloading:

```typescript
// apps/web/src/routes/features/$id.tsx
import { createFileRoute } from '@tanstack/react-router';
import { featureQueryOptions } from '@~/features/feature/hooks/queries/use-feature';
import { FeatureCard } from '@~/features/feature/components/feature-card';

export const Route = createFileRoute('/features/$id')({
  async loader({ context, params }) {
    // Preload data server-side for instant display
    await context.queryClient.ensureQueryData(featureQueryOptions(params.id));
  },
  component: FeaturePage,
});

function FeaturePage() {
  const { id } = Route.useParams();
  return (
    <div className="container mx-auto py-8">
      <FeatureCard id={id} />
    </div>
  );
}
```

## Step 3: Export Components

Update your feature index to export all public components:

```typescript
// apps/web/src/features/feature/index.ts (update)
export { FeatureCard } from './components/feature-card';
export { CreateFeatureForm } from './components/create-feature-form';
export { useFeature } from './hooks/queries/use-feature';
export { useCreateFeature } from './hooks/mutations/use-create-feature';
export type { FeatureQueryReturnType } from './hooks/queries/use-feature';
```

## Step 4: Add to Navigation (if needed)

Update your router layout or navigation to include the new route:

```typescript
// apps/web/src/routes/__root.tsx (example)
import { Link } from '@tanstack/react-router';

export function Navigation() {
  return (
    <nav>
      <Link to="/features">Features</Link>
    </nav>
  );
}
```

## Key Checkpoints

- [ ] Components handle loading/error/empty states
- [ ] Forms validate input with Zod schemas
- [ ] Routes preload data using query options
- [ ] All components are type-safe
- [ ] Navigation includes new routes
- [ ] Type-checking passes: `pnpm run check-types`

## Best Practices (from react-component-patterns)

- ✓ Use `useQuery` for data fetching (no loading in effects)
- ✓ Memoize components only when necessary (see `react-component-patterns`)
- ✓ Keep component logic focused (delegation to hooks)
- ✓ Use error boundaries for error handling
- ✓ Preload routes when possible

## Next Phase

Proceed to **Phase 5: Testing & Polish** to add tests and verify everything works correctly.

See also:
- `references/component-patterns.md` for component best practices
- `react-component-patterns` skill for advanced patterns
- Full example in `examples/feature-card.tsx`

