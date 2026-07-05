import { container } from 'tsyringe';
import { describe, expect, it } from 'vitest';

import { AchievementsService } from '@~/features/achievements/achievements.service';

import { createUser } from './utilities';

const getAchievementsService = () => container.resolve(AchievementsService);

describe('Achievements System', () => {
  it('should list all available achievements', async () => {
    const achievementsService = getAchievementsService();
    const achievements = await achievementsService.listAllAchievements();

    expect(achievements).toBeDefined();
    expect(achievements.length).toBeGreaterThan(0);
    expect(achievements[0]).toHaveProperty('id');
    expect(achievements[0]).toHaveProperty('label');
    expect(achievements[0]).toHaveProperty('description');
  });

  it('should return empty array for user with no achievements', async () => {
    const achievementsService = getAchievementsService();
    const user = await createUser();
    const userId = user.user.id;

    const userAchievements = await achievementsService.getUserAchievements(userId);

    expect(userAchievements).toBeDefined();
    expect(userAchievements).toHaveLength(0);
  });
});
