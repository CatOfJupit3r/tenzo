import { useQuery } from '@tanstack/react-query';

import { tanstackRPC } from '@~/utils/tanstack-orpc';

export function useHealthCheck() {
  return useQuery(tanstackRPC.index.healthCheck.queryOptions());
}

export type UseHealthCheckType = ReturnType<typeof useHealthCheck>;
