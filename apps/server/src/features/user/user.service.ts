import { injectable } from 'tsyringe';

import { errorCodes } from '@startername/shared';
import type { BadgeId } from '@startername/shared/constants/badges';

import { generatePublicCode } from '@~/db/helpers';
import { User } from '@~/db/models/auth.model';
import { UserAchievementModel } from '@~/db/models/user-achievements.model';
import { UserProfileModel } from '@~/db/models/user-profile.model';
import { BADGES_META } from '@~/features/badges/badges.constants';
import {
  ORPCBadRequestError,
  ORPCForbiddenError,
  ORPCInternalServerError,
  ORPCNotFoundError,
} from '@~/lib/orpc-error-wrapper';

import { LoggerFactory } from '../logger/logger.factory';
import type { iWithLogger } from '../logger/logger.types';

@injectable()
export class UserService implements iWithLogger {
  public readonly logger: iWithLogger['logger'];

  constructor(loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.create('user-service');
  }

  public async getUserProfile(userId: string) {
    const userProfile = await UserProfileModel.findOne({ userId });
    if (!userProfile) throw ORPCNotFoundError(errorCodes.USER_PROFILE_NOT_FOUND);
    return userProfile;
  }

  public async updateUserProfile(userId: string, bio: string) {
    try {
      const updatedProfile = await UserProfileModel.findOneAndUpdate(
        { userId },
        { bio },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      );

      if (!updatedProfile) {
        throw ORPCInternalServerError();
      }

      return updatedProfile;
    } catch (error) {
      if (error instanceof Error && error.name !== 'ORPCError') {
        throw ORPCInternalServerError();
      }
      throw error;
    }
  }

  public async updateUserBadge(userId: string, badgeId: BadgeId) {
    const badgeMeta = BADGES_META.find((b) => b.id === badgeId);
    if (!badgeMeta) {
      throw ORPCBadRequestError(errorCodes.BADGE_NOT_FOUND);
    }

    if (badgeMeta.requiresAchievement) {
      const hasAchievement = await UserAchievementModel.findOne({
        userId,
        achievementId: badgeMeta.requiresAchievement,
      });

      if (!hasAchievement) {
        throw ORPCForbiddenError(errorCodes.USER_BADGE_NOT_ALLOWED);
      }
    }

    try {
      const updatedProfile = await UserProfileModel.findOneAndUpdate(
        { userId },
        { selectedBadge: badgeId },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      );

      if (!updatedProfile) {
        throw ORPCInternalServerError();
      }

      return updatedProfile;
    } catch (error) {
      if (error instanceof Error && error.name !== 'ORPCError') {
        throw ORPCInternalServerError();
      }
      throw error;
    }
  }

  public async regeneratePublicCode(userId: string) {
    const maxAttempts = 10;
    const tryGenerateCode = async (attemptNumber: number): Promise<typeof UserProfileModel.prototype> => {
      if (attemptNumber >= maxAttempts) {
        throw ORPCInternalServerError(errorCodes.PUBLIC_CODE_GENERATION_FAILED);
      }

      const newPublicCode = generatePublicCode();

      try {
        const updatedProfile = await UserProfileModel.findOneAndUpdate(
          { userId },
          { publicCode: newPublicCode },
          { new: true, upsert: true, setDefaultsOnInsert: true },
        );

        if (!updatedProfile) {
          throw ORPCInternalServerError();
        }

        return updatedProfile;
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && (error as { code?: number }).code === 11000) {
          return tryGenerateCode(attemptNumber + 1);
        }

        if (error instanceof Error && error.name !== 'ORPCError') {
          throw ORPCInternalServerError();
        }

        throw error;
      }
    };

    return tryGenerateCode(0);
  }

  public async listAllUsers() {
    const users = await User.find({}, { _id: 1, name: 1 });
    return users.map(({ _id, name }) => ({ _id: _id.toString(), name }));
  }
}
