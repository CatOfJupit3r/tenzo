import { queryOptions, useQuery } from '@tanstack/react-query';

import { INTERVALS } from '@~/constants/dates';
import AuthService from '@~/services/auth.service';
import type { InternalAuthSession } from '@~/services/auth.service';
import { isOnClient } from '@~/utils/ssr-helpers';

const PLACEHOLDER_USER: InternalAuthSession = {
  user: {
    email: '',
    name: '',
    username: '',
    displayUsername: '',
    id: '',
    updatedAt: new Date(),
    createdAt: new Date(),
    emailVerified: true,
  },
  session: {
    id: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    userId: '',
    expiresAt: new Date(),
    token: '',
  },
};

export const USE_ME_QUERY_KEYS = () => ['user', 'me'];
export type MeQueryResultType = Awaited<ReturnType<typeof meQueryFn>>;
export const meQueryFn = async () => AuthService.getSession();

export const meQueryOptions = queryOptions({
  queryKey: USE_ME_QUERY_KEYS(),
  queryFn: meQueryFn,
  // Caching and retry configurations
  staleTime: isOnClient ? INTERVALS.ONE_MINUTE : 0, // Data considered fresh for 1 minutes
  refetchOnWindowFocus: true, // Refetch when window regains focus
  retry: 1, // Retry once on failure
});

/**
 * Central hook for getting user information
 * It is recommended to use this hook as it caches the user information and refetches every once in a while
 */
export const useMe = () => {
  const { data, isPending, isError, error, refetch, isSuccess } = useQuery(meQueryOptions);

  return {
    user: data?.user ?? PLACEHOLDER_USER?.user,
    session: data?.session ?? PLACEHOLDER_USER?.session,
    isPending,
    isError,
    isSuccess,
    error,
    refetch,
    isLoggedIn: Boolean(data?.user?.id && isSuccess),
  };
};

export type UseMe = ReturnType<typeof useMe>;
export default useMe;
