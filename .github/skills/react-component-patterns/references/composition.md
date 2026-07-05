# Component Composition Guide

Learn how to compose React components from UI primitives.

## Import from UI library

Always prefer importing primitives from `@~/components/ui`:

```typescript
import { Button } from '@~/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@~/components/ui/card';
import { Input } from '@~/components/ui/input';
import { Alert, AlertDescription } from '@~/components/ui/alert';
import { Skeleton } from '@~/components/ui/skeleton';
```

## Basic composition pattern

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

## Common UI primitives

### Layout components

- `Card`, `CardHeader`, `CardTitle`, `CardContent` - Card container with sections
- `Container` - Max-width container for page content
- `Separator` - Visual divider between sections

### Interactive components

- `Button` - Primary interactive element
- `Input` - Text input field
- `Select` - Dropdown selector
- `Checkbox` - Boolean toggle
- `RadioGroup` - Single selection from options
- `Textarea` - Multi-line text input

### Feedback components

- `Alert`, `AlertDescription` - Error/warning/info messages
- `Skeleton` - Loading placeholder
- `Toast` - Temporary notifications (via Sonner)
- `Empty` - Empty state display

### Navigation components

- `Tabs` - Tabbed content switching
- `Breadcrumb` - Navigation hierarchy
- `Pagination` - Multi-page navigation

## Component combination examples

### Card with header and actions

```typescript
import { Card, CardHeader, CardTitle, CardContent } from '@~/components/ui/card';
import { Button } from '@~/components/ui/button';

export function FeatureCard({ feature }: { feature: Feature }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>{feature.name}</CardTitle>
        <Button variant="ghost" size="sm">
          Edit
        </Button>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{feature.description}</p>
      </CardContent>
    </Card>
  );
}
```

### Form with validation feedback

```typescript
import { Input } from '@~/components/ui/input';
import { Button } from '@~/components/ui/button';
import { Alert, AlertDescription } from '@~/components/ui/alert';

export function SignupForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) {
      setError('Invalid email address');
      return;
    }
    // Handle signup
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit">Sign up</Button>
    </form>
  );
}
```

### Dialog/Modal pattern

```typescript
import { Button } from '@~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@~/components/ui/dialog';

export function DeleteConfirmation({ isOpen, onConfirm, onCancel }: Props) {
  return (
    <Dialog open={isOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete item?</DialogTitle>
          <DialogDescription>
            This action cannot be undone. The item will be permanently deleted.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

## Best practices

### Avoid creating custom components for one-off use

❌ **Don't**: Create custom wrappers
```typescript
function MyCustomButton(props: ButtonProps) {
  return <Button className="bg-blue-500" {...props} />;
}
```

✅ **Do**: Use primitives directly with className
```typescript
<Button className="bg-blue-500">Click me</Button>
```

### Compose complex layouts

❌ **Don't**: Nest primitives deeply without organization
```typescript
<div>
  <div>
    <div>
      <Card>...</Card>
    </div>
  </div>
</div>
```

✅ **Do**: Extract sub-components
```typescript
export function Layout({ children }: { children: React.ReactNode }) {
  return <div className="container mx-auto">{children}</div>;
}

export function Page() {
  return (
    <Layout>
      <Card>...</Card>
    </Layout>
  );
}
```

### Use semantic markup with primitives

Always use semantic HTML elements within primitives:

```typescript
<Card>
  <CardHeader>
    <CardTitle as="h1">Page Title</CardTitle>
  </CardHeader>
  <CardContent>
    <main>
      <section>
        <h2>Section</h2>
        <p>Content</p>
      </section>
    </main>
  </CardContent>
</Card>
```
