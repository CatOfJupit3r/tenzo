import type { iBadgeMeta } from '@startername/shared/constants/badges';
import { BADGE_IDS } from '@startername/shared/constants/badges';

export const BADGES_META: iBadgeMeta[] = [
  {
    id: BADGE_IDS.DEFAULT,
    label: 'Default Badge',
    description: 'The default badge for all users',
    icon: '🎖️',
  },
  {
    id: BADGE_IDS.BETA_TESTER,
    label: 'Beta Tester',
    description: 'Awarded for participating in the beta testing phase',
    icon: '🐉',
    requiresAchievement: 'BETA_TESTER',
  },
];
