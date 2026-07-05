import { mutationOptions, useMutation, useQuery } from '@tanstack/react-query';
import { createIsomorphicFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { useMemo } from 'react';

import { SingleSelect } from '@~/components/ui/select';
import { USE_ME_QUERY_KEYS } from '@~/features/user/hooks/use-me';
import { tanstackRPC } from '@~/utils/tanstack-orpc';

const listAllUsersQueryOptions = tanstackRPC.user.devToolsListAllUsers.queryOptions();

const getImpersonateURL = createIsomorphicFn()
  .client((userId: string) => `/api/dev-tools/impersonate/${userId}`)
  .server((userId: string) => `${process.env.VITE_SERVER_URL}/api/dev-tools/impersonate/${userId}`);

const fetchImpersonate = createIsomorphicFn()
  .client(async (userId: string) => {
    const response = await fetch(getImpersonateURL(userId), {
      method: 'GET',
    });
    if (!response.ok) {
      throw new Error('Failed to impersonate user');
    }
  })
  .server(async (userId: string) => {
    const response = await fetch(getImpersonateURL(userId), {
      method: 'GET',
      headers: getRequestHeaders(),
    });
    if (!response.ok) {
      throw new Error('Failed to impersonate user');
    }
  });

const impersonateMutationOptions = mutationOptions({
  mutationFn: async (userId: string) => fetchImpersonate(userId),
  onError: (error) => {
    console.error('Impersonation error:', error);
  },
  onSuccess: (_, __, ___, ctx) => {
    void ctx.client.refetchQueries({
      queryKey: USE_ME_QUERY_KEYS(),
    });
  },
});

function useImpersonate() {
  const { mutateAsync } = useMutation(impersonateMutationOptions);
  return { mutate: mutateAsync };
}

function useAvailableUsers() {
  const { data, isPending } = useQuery(listAllUsersQueryOptions);

  const options = useMemo(() => data?.map((user) => ({ label: user.name, value: user._id })) ?? [], [data]);

  return { options, isPending };
}

export function QuickSignIn() {
  const { options, isPending } = useAvailableUsers();
  const { mutate } = useImpersonate();

  return (
    <div className="my-6">
      <h3 className="mb-2 text-lg font-medium">Quick Sign In (Dev)</h3>
      <SingleSelect
        options={options}
        onValueChange={(value) => {
          if (!value) return;
          void mutate(value);
        }}
        isDisabled={isPending}
      />
    </div>
  );
}
