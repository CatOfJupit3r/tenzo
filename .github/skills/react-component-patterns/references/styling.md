# Styling with Tailwind CSS

Guide to styling React components with Tailwind CSS following project conventions.

## Use design tokens

Always use design token classes instead of hardcoded colors:

```typescript
// Good - uses design tokens
<div className="bg-background text-foreground border border-border">
  <h2 className="text-2xl font-semibold text-foreground">Title</h2>
  <p className="text-muted-foreground">Description</p>
</div>

// Bad - hardcoded colors
<div className="bg-white text-black border border-gray-200">
  <h2 className="text-2xl font-semibold text-black">Title</h2>
  <p className="text-gray-500">Description</p>
</div>
```

## Available design tokens

```typescript
// Colors
bg-background        // Main background
bg-foreground        // Inverse (usually dark)
text-foreground      // Main text
text-muted-foreground // Secondary text
border-border        // Border color
bg-primary           // Primary action
text-primary-foreground
bg-secondary         // Secondary action
bg-destructive       // Error/delete
text-destructive-foreground
bg-muted             // Disabled state
text-muted-foreground

// Also available with opacity: bg-primary/50, text-foreground/60
```

## Responsive design

Use mobile-first approach with Tailwind breakpoints:

```typescript
// Mobile by default, then larger screens
<div className="flex flex-col gap-4 md:flex-row md:gap-6 lg:gap-8">
  <div className="w-full md:w-1/2 lg:w-1/3">
    {/* Content takes full width on mobile, 50% on tablet, 33% on desktop */}
  </div>
</div>

// Breakpoints
// sm: 640px
// md: 768px
// lg: 1024px
// xl: 1280px
// 2xl: 1536px
```

## Container widths

Follow the existing layout rhythm:

```typescript
// Standard page container
<div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
  {/* Content */}
</div>

// Narrow container (for content-focused pages)
<div className="container mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
  {/* Content */}
</div>

// Full-width with padding
<div className="w-full px-4 sm:px-6 lg:px-8">
  {/* Content */}
</div>
```

## Spacing conventions

```typescript
// Use consistent spacing scale
gap-2   // 8px
gap-3   // 12px
gap-4   // 16px
gap-6   // 24px
gap-8   // 32px

// Padding
p-2, px-4, py-6, etc.

// Margins
m-2, mx-4, my-6, etc.
```

## Typography

```typescript
// Heading sizes
<h1 className="text-4xl font-bold">Page Title</h1>
<h2 className="text-2xl font-semibold">Section</h2>
<h3 className="text-xl font-semibold">Subsection</h3>

// Body text
<p className="text-base text-foreground">Regular text</p>
<p className="text-sm text-muted-foreground">Secondary text</p>

// Preformatted
<code className="bg-muted px-2 py-1 rounded text-sm font-mono">
  code here
</code>
```

## Flexbox and Grid

```typescript
// Flexbox - common patterns
<div className="flex items-center justify-between gap-4">
  {/* Items centered vertically, space-between horizontally */}
</div>

<div className="flex flex-col gap-2">
  {/* Vertical stack with small gap */}
</div>

<div className="flex flex-wrap gap-2">
  {/* Wrap items when needed */}
</div>

// Grid
<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
  {/* 1 column on mobile, 2 on tablet, 3 on desktop */}
</div>
```

## Common component patterns

### Card

```typescript
<div className="rounded-lg border border-border bg-background p-4 shadow-sm">
  <h3 className="font-semibold">Title</h3>
  <p className="text-sm text-muted-foreground">Content</p>
</div>
```

### Button group

```typescript
<div className="flex gap-2">
  <button className="rounded-md bg-primary px-4 py-2 text-primary-foreground">
    Primary
  </button>
  <button className="rounded-md border border-border bg-background px-4 py-2">
    Secondary
  </button>
</div>
```

### Badge/Pill

```typescript
<span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
  Active
</span>
```

### Input with label

```typescript
<div className="space-y-2">
  <label htmlFor="email" className="text-sm font-medium">
    Email
  </label>
  <input
    id="email"
    type="email"
    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
  />
</div>
```

## Dark mode

The project uses Tailwind's dark mode with CSS variables. Colors automatically adapt:

```typescript
// No special syntax needed - use the design token classes
<div className="bg-background text-foreground">
  {/* Automatically light in light mode, dark in dark mode */}
</div>

// If you need dark-mode specific styles:
<div className="bg-white dark:bg-black">
  {/* Custom dark mode override */}
</div>
```

## States and pseudo-classes

```typescript
// Hover, focus, active states
<button className="bg-primary hover:bg-primary/90 focus:ring-2 active:scale-95">
  Action
</button>

// Group states (when parent is hovered)
<div className="group">
  <button>Hover me</button>
  <div className="hidden group-hover:block">Revealed on hover</div>
</div>

// Responsive states
<div className="hidden md:block">
  {/* Shown only on medium screens and up */}
</div>
```

## Best practices

### Avoid inline style objects

❌ Don't
```typescript
<div style={{ backgroundColor: 'blue', padding: '16px' }}>
  Content
</div>
```

✅ Do
```typescript
<div className="bg-primary p-4">
  Content
</div>
```

### Extract repeated styles to components

If you find yourself using the same class combination repeatedly:

```typescript
// Don't repeat
<div className="rounded-lg border border-border bg-background p-4 shadow-sm">
<div className="rounded-lg border border-border bg-background p-4 shadow-sm">

// Create a component
export function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4 shadow-sm">
      {children}
    </div>
  );
}
```

### Use @apply only for shared styles

```typescript
/* In CSS file - use sparingly */
@layer components {
  .card {
    @apply rounded-lg border border-border bg-background p-4 shadow-sm;
  }
}
```

### Keep className readable

Split long className strings for readability:

```typescript
<div
  className={cn(
    'flex items-center justify-between gap-4',
    'rounded-lg border border-border bg-background',
    'p-4 shadow-sm',
    isActive && 'ring-2 ring-primary'
  )}
>
  {/* Content */}
</div>
```
