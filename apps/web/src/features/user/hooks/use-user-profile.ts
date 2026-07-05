import { useQuery } from '@tanstack/react-query';

import { tanstackRPC } from '@~/utils/tanstack-orpc';

export function useUserProfile() {
  return useQuery(tanstackRPC.user.getUserProfile.queryOptions());
}
