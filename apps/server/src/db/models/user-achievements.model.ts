import { getModelForClass, index, modelOptions, prop, Severity } from '@typegoose/typegoose';
import type { DocumentType } from '@typegoose/typegoose';

import type { UserAchievementId } from '@startername/shared/constants/achievements';

import { idProp } from '../prop';

@index({ userId: 1, achievementId: 1 }, { unique: true })
@modelOptions({
  schemaOptions: {
    collection: 'user_achievements',
    timestamps: true,
  },
  options: {
    customName: 'UserAchievement',
  },
})
export class UserAchievementClass {
  @idProp()
  public _id!: string;

  @prop({ required: true, index: true })
  public userId!: string;

  @prop({ type: String, required: true, index: true })
  public achievementId!: UserAchievementId;

  @prop({ required: true })
  public unlockedAt!: Date;

  @prop({ type: () => Object, allowMixed: Severity.ALLOW })
  public data?: Record<string, unknown>;

  public createdAt!: Date;

  public updatedAt!: Date;
}

export const UserAchievementModel = getModelForClass(UserAchievementClass);
export type UserAchievementDoc = DocumentType<UserAchievementClass>;
