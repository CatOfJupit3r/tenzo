import { useQuery } from '@tanstack/react-query';

import type { ORPCOutputs } from '@~/utils/orpc';
import { tanstackRPC } from '@~/utils/tanstack-orpc';

export type AllAchievementsQueryReturnType = ORPCOutputs['achievements']['listAchievements'];

export function useAllAchievements() {
  return useQuery(tanstackRPC.achievements.listAchievements.queryOptions());
}
