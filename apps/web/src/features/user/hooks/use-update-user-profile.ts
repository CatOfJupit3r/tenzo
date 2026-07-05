import { useMutation } from '@tanstack/react-query';

import { toastORPCError, toastSuccess } from '@~/components/toastifications';
import type { ORPCOutputs } from '@~/utils/orpc';
import { tanstackRPC } from '@~/utils/tanstack-orpc';

export type UserProfileQueryReturnType = ORPCOutputs['user']['getUserProfile'];

export const updateUserProfileMutationOptions = tanstackRPC.user.updateUserProfile.mutationOptions({
  async onMutate(variables, ctx) {
    const key = tanstackRPC.user.getUserProfile.queryKey();

    await ctx.client.cancelQueries({ queryKey: key });

    const previous = ctx.client.getQueryData<UserProfileQueryReturnType>(key);

    ctx.client.setQueryData<UserProfileQueryReturnType>(key, (current) =>
      current ? { ...current, bio: variables.bio } : current,
    );

    return { previous };
  },
  onError: (error, _variables, context, ctx) => {
    const key = tanstackRPC.user.getUserProfile.queryKey();

    if (context?.previous) {
      ctx.client.setQueryData<UserProfileQueryReturnType>(key, context.previous);
    } else {
      void ctx.client.invalidateQueries({ queryKey: key });
    }

    toastORPCError('Failed to update profile', error);
  },
  onSuccess: (data, _variables, _context, ctx) => {
    const key = tanstackRPC.user.getUserProfile.queryKey();

    ctx.client.setQueryData<UserProfileQueryReturnType>(key, data);
    toastSuccess('Profile updated successfully');
  },
});

export function useUpdateUserProfile() {
  const { mutate: updateUserProfile, isPending } = useMutation(updateUserProfileMutationOptions);

  return {
    updateUserProfile,
    isPending,
  };
}
