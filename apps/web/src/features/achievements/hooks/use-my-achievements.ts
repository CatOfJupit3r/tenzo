import { useQuery } from '@tanstack/react-query';

import type { ORPCOutputs } from '@~/utils/orpc';
import { tanstackRPC } from '@~/utils/tanstack-orpc';

export type MyAchievementsQueryReturnType = ORPCOutputs['achievements']['getMyAchievements'];

export function useMyAchievements() {
  return useQuery(tanstackRPC.achievements.getMyAchievements.queryOptions());
}
