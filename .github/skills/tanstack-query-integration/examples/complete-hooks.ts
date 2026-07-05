// Example: TanStack Query hooks with optimistic updates
// Location: apps/web/src/features/example/hooks/queries/use-example.ts

import { useQuery } from '@tanstack/react-query';
import { tanstackRPC } from '@~/utils/tanstack-orpc';
import type { ORPCOutputs } from '@~/utils/orpc';

// Export query options for reuse
export const exampleQueryOptions = (id: string) =>
  tanstackRPC.example.getExample.queryOptions({
    input: { id },
  });

// Export return type for mutations
export type ExampleQueryReturnType = ORPCOutputs['example']['getExample'];

// Export the hook
export function useExample(id: string) {
  return useQuery(exampleQueryOptions(id));
}

// ============================================
// Location: apps/web/src/features/example/hooks/mutations/use-update-example.ts

import { useMutation } from '@tanstack/react-query';
import { tanstackRPC } from '@~/utils/tanstack-orpc';
import { type ExampleQueryReturnType } from '../queries/use-example';

export const updateExampleMutationOptions = tanstackRPC.example.updateExample.mutationOptions({
  // Optimistic update
  async onMutate({ params: { id, name, description } }, ctx) {
    const key = tanstackRPC.example.getExample.queryKey({ input: { id } });

    // Cancel in-flight queries
    await ctx.client.cancelQueries({ queryKey: key });

    // Snapshot previous data
    const previous = ctx.client.getQueryData<ExampleQueryReturnType>(key);

    // Apply optimistic update
    ctx.client.setQueryData<ExampleQueryReturnType>(key, (oldData) => {
      if (!oldData) return oldData;
      return {
        ...oldData,
        ...(name && { name }),
        ...(description !== undefined && { description }),
      };
    });

    return { previous };
  },

  // Rollback on error
  onError: (_error, { params: { id } }, context, ctx) => {
    const key = tanstackRPC.example.getExample.queryKey({ input: { id } });

    if (context?.previous) {
      ctx.client.setQueryData<ExampleQueryReturnType>(key, context.previous);
    } else {
      void ctx.client.invalidateQueries({ queryKey: key });
    }
  },

  // Update with server response
  onSuccess: (data, { params: { id } }, _context, ctx) => {
    const key = tanstackRPC.example.getExample.queryKey({ input: { id } });
    ctx.client.setQueryData<ExampleQueryReturnType>(key, data);

    // Also invalidate the list
    void ctx.client.invalidateQueries({
      queryKey: tanstackRPC.example.listPublicExamples.queryKey(),
    });
  },
});

export function useUpdateExample() {
  const { mutate: updateExample, isPending } = useMutation(updateExampleMutationOptions);

  return {
    updateExample,
    isPending,
  };
}

// ============================================
// Location: apps/web/src/features/example/hooks/mutations/use-delete-example.ts

export const deleteExampleMutationOptions = tanstackRPC.example.deleteExample.mutationOptions({
  // No optimistic update for deletions - wait for server confirmation
  onSuccess: (_data, { params: { id } }, _context, ctx) => {
    // Remove from cache
    ctx.client.removeQueries({
      queryKey: tanstackRPC.example.getExample.queryKey({ input: { id } }),
    });

    // Invalidate list
    void ctx.client.invalidateQueries({
      queryKey: tanstackRPC.example.listPublicExamples.queryKey(),
    });
  },
});

export function useDeleteExample() {
  const { mutate: deleteExample, isPending } = useMutation(deleteExampleMutationOptions);

  return {
    deleteExample,
    isPending,
  };
}
