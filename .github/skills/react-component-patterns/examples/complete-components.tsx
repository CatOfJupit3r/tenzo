// Example: React component with forms and loading states
// Location: apps/web/src/features/example/components/example-form.tsx

import z from 'zod';
import { Button } from '@~/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@~/components/ui/card';
import { useAppForm } from '@~/components/ui/field';
import { useCreateExample } from '../hooks/mutations/use-create-example';
import { useUpdateExample } from '../hooks/mutations/use-update-example';

const exampleSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().max(500, 'Description must be 500 characters or less').optional(),
});

type ExampleFormData = z.infer<typeof exampleSchema>;

interface ExampleFormProps {
  example?: {
    _id: string;
    name: string;
    description?: string;
  };
  onSuccess?: () => void;
}

export function ExampleForm({ example, onSuccess }: ExampleFormProps) {
  const { createExample, isPending: isCreating } = useCreateExample();
  const { updateExample, isPending: isUpdating } = useUpdateExample();

  const isEditing = !!example;
  const isPending = isCreating || isUpdating;

  const form = useAppForm<ExampleFormData>({
    defaultValues: {
      name: example?.name ?? '',
      description: example?.description ?? '',
    },
    validators: {
      onSubmit: exampleSchema,
    },
    onSubmit: async ({ value }) => {
      if (isEditing) {
        updateExample(
          {
            params: {
              id: example._id,
              ...value,
            },
          },
          {
            onSuccess: () => {
              onSuccess?.();
            },
          }
        );
      } else {
        createExample(
          {
            params: value,
          },
          {
            onSuccess: () => {
              onSuccess?.();
            },
          }
        );
      }
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? 'Edit Example' : 'Create Example'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form.AppForm>
          <form.Form className="space-y-4">
            <form.AppField name="name">
              {(field) => <field.TextField label="Name" placeholder="Enter example name" />}
            </form.AppField>

            <form.AppField name="description">
              {(field) => (
                <field.TextareaField label="Description" placeholder="Enter a description (optional)" />
              )}
            </form.AppField>

            <form.SubmitButton disabled={isPending}>
              {isPending ? 'Saving...' : isEditing ? 'Update Example' : 'Create Example'}
            </form.SubmitButton>
          </form.Form>
        </form.AppForm>
      </CardContent>
    </Card>
  );
}

// ============================================
// Location: apps/web/src/features/example/components/example-card.tsx

import { Card, CardHeader, CardTitle, CardContent } from '@~/components/ui/card';
import { Button } from '@~/components/ui/button';
import { Skeleton } from '@~/components/ui/skeleton';
import { Alert, AlertDescription } from '@~/components/ui/alert';
import { Empty } from '@~/components/ui/empty';
import { useExample } from '../hooks/queries/use-example';
import { useDeleteExample } from '../hooks/mutations/use-delete-example';

export function ExampleCard({ id }: { id: string }) {
  const { data: example, isPending, error } = useExample(id);
  const { deleteExample, isPending: isDeleting } = useDeleteExample();

  // Loading state
  if (isPending) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Failed to load example: {error.message}</AlertDescription>
      </Alert>
    );
  }

  // Empty state
  if (!example) {
    return <Empty>Example not found</Empty>;
  }

  // Success state
  return (
    <Card>
      <CardHeader>
        <CardTitle>{example.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{example.description || 'No description'}</p>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" size="sm">
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={isDeleting}
            onClick={() => deleteExample({ params: { id: example._id } })}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
