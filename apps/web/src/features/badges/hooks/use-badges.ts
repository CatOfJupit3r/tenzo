import { useQuery } from '@tanstack/react-query';

import type { ORPCOutputs } from '@~/utils/orpc';
import { tanstackRPC } from '@~/utils/tanstack-orpc';

export type BadgesQueryReturnType = ORPCOutputs['badges']['listBadges'];

export function useBadges() {
  return useQuery(tanstackRPC.badges.listBadges.queryOptions());
}
