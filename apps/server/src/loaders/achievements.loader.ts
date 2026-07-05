import { container } from 'tsyringe';

import { AchievementsService } from '@~/features/achievements/achievements.service';

export default async function achievementsLoader() {
  const achievementsService = container.resolve(AchievementsService);
  achievementsService.initialize();
}
