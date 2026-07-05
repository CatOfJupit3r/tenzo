import type { iUserAchievementMeta } from '@startername/shared/constants/achievements';
import { USER_ACHIEVEMENTS } from '@startername/shared/constants/achievements';

export const USER_ACHIEVEMENTS_META: iUserAchievementMeta[] = [
  {
    id: USER_ACHIEVEMENTS.BETA_TESTER,
    label: 'Beta Tester',
    description: 'Awarded for participating in the beta testing phase.',
    icon: '🏅',
    badgeId: 'beta_tester_badge',
  },
];
