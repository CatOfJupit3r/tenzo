import { getModelForClass, modelOptions, prop } from '@typegoose/typegoose';
import type { DocumentType } from '@typegoose/typegoose';

import type { BadgeId } from '@startername/shared/constants/badges';

import { generatePublicCode } from '../helpers';
import { idProp } from '../prop';

@modelOptions({ schemaOptions: { collection: 'profile', timestamps: true } })
class UserProfileClass {
  @idProp({ required: true })
  public _id!: string;

  @prop({ required: true, unique: true, index: true })
  public userId!: string;

  @prop({ default: () => '', maxlength: 500 })
  public bio!: string;

  @prop({ type: String, default: null })
  public selectedBadge?: BadgeId | null;

  @prop({ required: true, unique: true, index: true, default: () => generatePublicCode() })
  public publicCode!: string;

  public createdAt!: Date;

  public updatedAt!: Date;
}

export const UserProfileModel = getModelForClass(UserProfileClass);
export type UserProfileDoc = DocumentType<UserProfileClass>;
