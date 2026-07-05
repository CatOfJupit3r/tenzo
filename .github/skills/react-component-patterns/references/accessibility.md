# Accessibility Patterns

Guidelines for building accessible React components.

## Semantic HTML structure

Always use semantic HTML elements for better accessibility:

```typescript
// Good - semantic structure
<main>
  <h1>Page Title</h1>
  <section>
    <h2>Section Title</h2>
    <article>
      <h3>Article Title</h3>
      <p>Content</p>
    </article>
  </section>
</main>

// Bad - div soup without semantics
<div>
  <div className="title">Page Title</div>
  <div>
    <div className="subtitle">Section Title</div>
    <div>
      <div className="heading">Article Title</div>
      <div>Content</div>
    </div>
  </div>
</div>
```

## Form labels and associations

Always associate labels with form fields:

```typescript
// Good - explicit label association
<form.AppField name="email">
  {(field) => <field.TextField label="Email address" />}
</form.AppField>

// Also good - htmlFor attribute
<div>
  <label htmlFor="email">Email address</label>
  <input id="email" type="email" />
</div>

// Bad - no label association
<input type="email" placeholder="Email" />
```

## Icon-only buttons

Always provide accessible labels for icon-only buttons:

```typescript
import { X } from 'lucide-react';
import { Button } from '@~/components/ui/button';

// Good - aria-label
<Button aria-label="Close dialog">
  <X className="h-4 w-4" />
</Button>

// Good - title attribute (accessible via hover)
<Button title="Close dialog">
  <X className="h-4 w-4" />
</Button>

// Bad - no label
<Button>
  <X className="h-4 w-4" />
</Button>
```

## Screen reader only text

Hide content visually but keep it for screen readers:

```typescript
import { Loader2 } from 'lucide-react';

function LoadingButton() {
  return (
    <button>
      <Loader2 className="h-4 w-4 animate-spin mr-2" />
      <span className="sr-only">Loading</span>
      Processing...
    </button>
  );
}
```

## Keyboard navigation

Ensure all interactive elements are keyboard accessible:

```typescript
// Good - semantic button
<Button onClick={handleAction}>
  Action
</Button>

// Good - proper keyboard event handling
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }}
>
  Custom Button
</div>

// Bad - not keyboard accessible
<div onClick={handleClick} style={{ cursor: 'pointer' }}>
  Click me
</div>
```

## Focus management

Make focus visible and manage it properly:

```typescript
function Dialog({ isOpen, onClose }: Props) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Move focus into the dialog
      closeButtonRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <h2 id="dialog-title">Dialog Title</h2>
      <p>Content</p>
      <button ref={closeButtonRef} onClick={onClose}>
        Close
      </button>
    </div>
  );
}
```

## ARIA attributes

Use ARIA attributes appropriately:

```typescript
// Good - aria-label for icon-only buttons
<Button aria-label="Delete item">
  <Trash2 className="h-4 w-4" />
</Button>

// Good - aria-describedby for additional context
<input
  id="email"
  type="email"
  aria-describedby="email-hint"
/>
<small id="email-hint">We'll never share your email</small>

// Good - aria-live for dynamic content
<div aria-live="polite" aria-atomic="true">
  {notification}
</div>

// Good - aria-expanded for collapsible content
<button aria-expanded={isOpen} onClick={() => setIsOpen(!isOpen)}>
  Options
</button>
{isOpen && <div>Options content</div>}

// Good - aria-disabled instead of disabled for custom components
<CustomButton aria-disabled={isDisabled}>
  Action
</CustomButton>
```

## Color contrast

Ensure sufficient color contrast between text and background:

```typescript
// Good - sufficient contrast ratio
<div className="text-foreground bg-background">
  Text with sufficient contrast
</div>

// Bad - insufficient contrast
<div className="text-gray-400 bg-white">
  Low contrast text
</div>
```

## Alternative text for images

```typescript
// Good - descriptive alt text
<img
  src="/chart.png"
  alt="Sales trend showing 25% increase over Q1"
/>

// Good - empty alt for decorative images
<img src="/decorative-line.png" alt="" />

// Bad - generic alt text
<img src="/chart.png" alt="Chart" />
```

## Accessible form errors

```typescript
function EmailInput() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const errorId = useId();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);

    if (value && !value.includes('@')) {
      setError('Please enter a valid email address');
    } else {
      setError('');
    }
  };

  return (
    <div>
      <label htmlFor="email">Email</label>
      <input
        id="email"
        type="email"
        value={email}
        onChange={handleChange}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={!!error}
      />
      {error && (
        <p id={errorId} className="text-red-500 text-sm mt-1" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
```

## Accessible tables

```typescript
function DataTable({ data }: Props) {
  return (
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {data.map((row) => (
          <tr key={row.id}>
            <td>{row.name}</td>
            <td>{row.email}</td>
            <td>
              <button aria-label={`Edit ${row.name}`}>Edit</button>
              <button aria-label={`Delete ${row.name}`}>Delete</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

## Best practices

### Test with keyboard only

Regularly test your components using only keyboard navigation (no mouse).

### Use semantic components

Prefer semantic HTML elements (`<button>`, `<input>`, `<nav>`) over generic `<div>` with ARIA.

### Test with screen readers

Use tools like NVDA, JAWS, or VoiceOver to test how your components sound to screen reader users.

### Maintain focus indicators

Never remove the focus outline without providing a visible alternative:

```typescript
// Good - custom focus style
<button
  className="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
>
  Action
</button>

// Bad - removed focus without replacement
<button className="focus:outline-none">
  Action
</button>
```

### Use proper heading hierarchy

Don't skip heading levels (h1 -> h2 -> h4 is bad):

```typescript
// Good
<h1>Page Title</h1>
<h2>Section</h2>
<h3>Subsection</h3>

// Bad
<h1>Page Title</h1>
<h4>Section</h4> {/* Skipped h2, h3 */}
```
