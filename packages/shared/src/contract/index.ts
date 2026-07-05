import achievementsContract from './achievements.contract';
import badgesContract from './badges.contract';
import indexContract from './index.contract';
import userContract from './user.contract';

export const CONTRACT = {
  user: userContract,
  index: indexContract,
  achievements: achievementsContract,
  badges: badgesContract,
};

export type AppContract = typeof CONTRACT;

export default CONTRACT;
