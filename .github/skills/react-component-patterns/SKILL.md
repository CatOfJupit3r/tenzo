---
name: react-component-patterns
description: Create React components following project conventions for UI composition, accessibility, and styling. Use when building new UI components, forms with validation, accessible interactive elements, composing from existing UI primitives, managing URL state with nuqs, or handling loading and error states.
---

# React Component Patterns

**See [examples/complete-components.tsx](examples/complete-components.tsx) for complete working component examples.**

## Core principles

- Compose from `@~/components/ui` primitives rather than creating from scratch
- Use Tailwind CSS for styling with existing design tokens
- Follow accessibility best practices
- Implement proper loading and error states
- Manage URL state with nuqs for shareable views

## Component composition basics

Always compose from `@~/components/ui` primitives rather than building from scratch:

```typescript
import { Card, CardHeader, CardTitle, CardContent } from '@~/components/ui/card';
import { Button } from '@~/components/ui/button';

export function UserCard({ user }: { user: User }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{user.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">{user.email}</p>
        <Button className="mt-4">View Profile</Button>
      </CardContent>
    </Card>
  );
}
```

**See [references/composition.md](references/composition.md) for complete guide to component composition and available UI primitives.**

## Form patterns

Build forms with TanStack Form and Zod validation for type safety:

```typescript
import z from 'zod';
import { useAppForm } from '@~/components/ui/field';

const profileSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export function ProfileForm() {
  const form = useAppForm({
    defaultValues: { email: '' },
    validators: { onSubmit: profileSchema },
    onSubmit: async ({ value }) => {
      await updateProfile(value);
    },
  });

  return (
    <form.AppForm>
      <form.Form className="space-y-4">
        <form.AppField name="email">
          {(field) => <field.TextField label="Email" type="email" />}
        </form.AppField>
        <form.SubmitButton>Save</form.SubmitButton>
      </form.Form>
    </form.AppForm>
  );
}
```

**See [references/forms.md](references/forms.md) for validation, cross-field validation, conditional fields, and async validation patterns.**

## URL state management

Use nuqs to manage filters, sorting, and pagination in the URL:

```typescript
import { useQueryStates, parseAsString } from 'nuqs';

export function SearchBar() {
  const [{ search }, setParams] = useQueryStates({
    search: parseAsString.withDefault(''),
  });

  return (
    <input
      value={search}
      onChange={(e) => void setParams({ search: e.target.value || null })}
      placeholder="Search..."
    />
  );
}
```

Benefits: shareable links, browser history, bookmarkable states, SEO-friendly.

**See [references/url-state.md](references/url-state.md) for pagination, filtering, date ranges, and best practices.**

## Loading, error, and empty states

Handle all data-fetching states properly:

```typescript
function UserProfile({ userId }: { userId: string }) {
  const { data: user, isPending, error } = useUserProfile(userId);

  if (isPending) return <Skeleton className="h-32 w-full" />;
  if (error) return <Alert variant="destructive">Failed to load</Alert>;
  if (!user) return <Empty>User not found</Empty>;

  return <div>{user.name}</div>;
}
```

**See [references/states.md](references/states.md) for loading skeletons, route-level PseudoPage, empty states, error handling, and progressive loading.**

## Accessibility

Build accessible components with semantic HTML, proper labels, and keyboard support:

```typescript
// Semantic HTML
<main>
  <h1>Page Title</h1>
  <section>
    <h2>Section</h2>
  </section>
</main>

// Proper form labels
<form.AppField name="email">
  {(field) => <field.TextField label="Email address" />}
</form.AppField>

// Icon-only buttons need labels
<Button aria-label="Close dialog">
  <X className="h-4 w-4" />
</Button>
```

**See [references/accessibility.md](references/accessibility.md) for semantic HTML, ARIA attributes, keyboard navigation, focus management, and screen reader support.**

## Styling with Tailwind

Use design tokens instead of hardcoded colors:

```typescript
// Good - design tokens
<div className="bg-background text-foreground border-border">
  <h2 className="text-2xl font-semibold">Title</h2>
  <p className="text-muted-foreground">Description</p>
</div>

// Bad - hardcoded colors
<div className="bg-white text-black border-gray-200">...</div>
```

Available tokens: `bg-background`, `text-foreground`, `border-border`, `text-muted-foreground`, `bg-primary`, `bg-destructive`, etc.

**See [references/styling.md](references/styling.md) for responsive design, container widths, spacing conventions, and common component patterns.**

## Component organization

Organize code by feature/domain with a clear public API:

```
apps/web/src/features/challenges/
  ├── components/
  │   ├── challenge-card.tsx
  │   ├── challenge-list.tsx
  │   └── index.ts
  ├── hooks/
  │   ├── queries/
  │   │   └── use-challenge.ts
  │   └── mutations/
  │       └── use-create-challenge.ts
  └── index.ts  # Exports public API
```

Public API:
```typescript
export { ChallengeCard, ChallengeList } from './components';
export { useChallenge, useCreateChallenge } from './hooks';
```

**See [references/best-practices.md](references/best-practices.md) for component structure, avoiding prop drilling, keeping components focused, and composition patterns.**
