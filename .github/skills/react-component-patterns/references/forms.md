# Form Patterns Guide

Complete guide to building forms with TanStack Form and validation.

## Using TanStack Form with AppForm

The project provides `useAppForm` hook which wraps TanStack Form with automatic field rendering:

```typescript
import z from 'zod';
import { useAppForm } from '@~/components/ui/field';

const profileSchema = z.object({
  displayName: z.string().min(2, 'Display name must be at least 2 characters'),
  bio: z.string().max(280, 'Bio must be 280 characters or less').optional(),
  email: z.string().email('Invalid email address'),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export function ProfileForm() {
  const form = useAppForm<ProfileFormData>({
    defaultValues: {
      displayName: '',
      bio: '',
      email: '',
    },
    validators: {
      onSubmit: profileSchema,
    },
    onSubmit: async ({ value }) => {
      // Handle submission
      await updateProfile(value);
    },
  });

  return (
    <form.AppForm>
      <form.Form className="space-y-4">
        <form.AppField name="displayName">
          {(field) => <field.TextField label="Display name" placeholder="Enter your name" />}
        </form.AppField>

        <form.AppField name="bio">
          {(field) => <field.TextareaField label="Bio" placeholder="Tell us about yourself" />}
        </form.AppField>

        <form.AppField name="email">
          {(field) => <field.TextField label="Email" type="email" />}
        </form.AppField>

        <form.SubmitButton>Save changes</form.SubmitButton>
      </form.Form>
    </form.AppForm>
  );
}
```

## Form with cross-field validation

When you need to validate one field based on another field's value:

```typescript
import z from 'zod';
import { useAppForm } from '@~/components/ui/field';

const passwordSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'], // Which field gets the error
  });

export function ChangePasswordForm() {
  const form = useAppForm({
    defaultValues: { password: '', confirmPassword: '' },
    validators: {
      onSubmit: passwordSchema,
    },
    onSubmit: async ({ value }) => {
      await changePassword(value.password);
    },
  });

  return (
    <form.AppForm>
      <form.Form className="space-y-4">
        <form.AppField name="password">
          {(field) => (
            <field.TextField
              label="New password"
              type="password"
              placeholder="••••••••"
            />
          )}
        </form.AppField>

        <form.AppField name="confirmPassword">
          {(field) => (
            <field.TextField
              label="Confirm password"
              type="password"
              placeholder="••••••••"
            />
          )}
        </form.AppField>

        <form.SubmitButton>Update password</form.SubmitButton>
      </form.Form>
    </form.AppForm>
  );
}
```

## Form with conditional fields

Show/hide fields based on other field values:

```typescript
import z from 'zod';
import { useAppForm } from '@~/components/ui/field';

const accountSchema = z.object({
  accountType: z.enum(['personal', 'business']),
  companyName: z.string().optional(),
});

export function AccountForm() {
  const form = useAppForm({
    defaultValues: { accountType: 'personal', companyName: '' },
    validators: { onSubmit: accountSchema },
    onSubmit: async ({ value }) => {
      // Submit
    },
  });

  const accountType = form.watch('accountType');

  return (
    <form.AppForm>
      <form.Form className="space-y-4">
        <form.AppField name="accountType">
          {(field) => (
            <field.SelectField label="Account type">
              <option value="personal">Personal</option>
              <option value="business">Business</option>
            </field.SelectField>
          )}
        </form.AppField>

        {accountType === 'business' && (
          <form.AppField name="companyName">
            {(field) => (
              <field.TextField label="Company name" placeholder="Acme Inc." />
            )}
          </form.AppField>
        )}

        <form.SubmitButton>Create account</form.SubmitButton>
      </form.Form>
    </form.AppForm>
  );
}
```

## Form with async validation

Validate fields against the server (e.g., checking email uniqueness):

```typescript
import z from 'zod';
import { useAppForm } from '@~/components/ui/field';

const signupSchema = z.object({
  email: z.string().email('Invalid email').refine(
    async (email) => {
      const exists = await checkEmailExists(email);
      return !exists;
    },
    'Email is already registered'
  ),
  username: z.string().min(3, 'Username must be at least 3 characters'),
});

export function SignupForm() {
  const form = useAppForm({
    defaultValues: { email: '', username: '' },
    validators: { onSubmit: signupSchema },
    onSubmit: async ({ value }) => {
      await createAccount(value);
    },
  });

  return (
    <form.AppForm>
      <form.Form className="space-y-4">
        <form.AppField name="email">
          {(field) => <field.TextField label="Email" type="email" />}
        </form.AppField>

        <form.AppField name="username">
          {(field) => <field.TextField label="Username" />}
        </form.AppField>

        <form.SubmitButton>Create account</form.SubmitButton>
      </form.Form>
    </form.AppForm>
  );
}
```

## Form with field arrays (dynamic fields)

Handle lists of form fields:

```typescript
import z from 'zod';
import { useAppForm } from '@~/components/ui/field';
import { Button } from '@~/components/ui/button';

const contactSchema = z.object({
  name: z.string(),
  emails: z.array(z.string().email()),
});

export function ContactForm() {
  const form = useAppForm({
    defaultValues: {
      name: '',
      emails: [''],
    },
    validators: { onSubmit: contactSchema },
    onSubmit: async ({ value }) => {
      // Submit
    },
  });

  const emails = form.watch('emails');

  return (
    <form.AppForm>
      <form.Form className="space-y-4">
        <form.AppField name="name">
          {(field) => <field.TextField label="Name" />}
        </form.AppField>

        <div className="space-y-2">
          <label className="text-sm font-medium">Email addresses</label>
          {emails.map((_, index) => (
            <form.AppField key={index} name={`emails.${index}`}>
              {(field) => (
                <field.TextField
                  placeholder={`Email ${index + 1}`}
                  defaultValue={emails[index]}
                />
              )}
            </form.AppField>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              // Add new email field
              form.setFieldValue('emails', [...emails, '']);
            }}
          >
            Add email
          </Button>
        </div>

        <form.SubmitButton>Save contact</form.SubmitButton>
      </form.Form>
    </form.AppForm>
  );
}
```

## File upload form

```typescript
import z from 'zod';
import { useAppForm } from '@~/components/ui/field';

const fileSchema = z.object({
  file: z
    .instanceof(File)
    .refine((file) => file.size <= 5 * 1024 * 1024, 'File must be under 5MB'),
});

export function FileUploadForm() {
  const form = useAppForm({
    defaultValues: { file: undefined },
    validators: { onSubmit: fileSchema },
    onSubmit: async ({ value }) => {
      const formData = new FormData();
      formData.append('file', value.file);
      await uploadFile(formData);
    },
  });

  return (
    <form.AppForm>
      <form.Form className="space-y-4">
        <form.AppField name="file">
          {(field) => (
            <div>
              <label className="text-sm font-medium">Upload file</label>
              <input
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    form.setFieldValue('file', file);
                  }
                }}
                className="block w-full text-sm text-gray-500"
              />
              {field.state.meta.errors && (
                <p className="text-sm text-red-500 mt-1">
                  {field.state.meta.errors[0]}
                </p>
              )}
            </div>
          )}
        </form.AppField>

        <form.SubmitButton>Upload</form.SubmitButton>
      </form.Form>
    </form.AppForm>
  );
}
```

## Best practices

### Always use Zod schemas

Keep validation rules in one place using Zod schemas rather than inline validation.

### Use proper input types

```typescript
// Good
<field.TextField type="email" />
<field.TextField type="password" />
<field.TextField type="number" />
<field.TextField type="date" />

// Bad - generic text field
<Input type="text" />
```

### Show inline errors

Always display validation errors near the field that has the error.

### Disable submit button while loading

The `form.SubmitButton` automatically handles this, but if using a custom button:

```typescript
<Button disabled={form.formState.isSubmitting}>
  {form.formState.isSubmitting ? 'Saving...' : 'Save'}
</Button>
```

### Provide helpful error messages

Write error messages from the user's perspective:

```typescript
// Good
z.string().email('Please enter a valid email address')

// Bad
z.string().email('Invalid email format')
```
