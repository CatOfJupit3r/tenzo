import { useMutation } from '@tanstack/react-query';

import { toastError, toastSuccess } from '@~/components/toastifications';
import { tanstackRPC } from '@~/utils/tanstack-orpc';

export const regeneratePublicCodeMutationOptions = tanstackRPC.user.regeneratePublicCode.mutationOptions({
  onSuccess: (_data, _variables, _context, ctx) => {
    void ctx.client.invalidateQueries({ queryKey: tanstackRPC.user.getUserProfile.queryKey() });
    toastSuccess('Invite code regenerated successfully');
  },
  onError: () => {
    toastError('Failed to regenerate invite code');
  },
});

export function useRegeneratePublicCode() {
  const { mutate: regeneratePublicCode, isPending } = useMutation(regeneratePublicCodeMutationOptions);

  return {
    regeneratePublicCode,
    isPending,
  };
}
