import { getModelForClass, modelOptions, prop } from '@typegoose/typegoose';

import { idProp } from '../prop';

@modelOptions({ schemaOptions: { collection: 'user' } })
class UserClass {
  @idProp({ required: true })
  public _id!: string;

  @prop({ required: true })
  public name!: string;

  @prop({ required: true, unique: true })
  public email!: string;

  @prop({ required: true, default: false })
  public emailVerified!: boolean;

  @prop()
  public image?: string;

  @prop({ required: true })
  public createdAt!: Date;

  @prop({ required: true })
  public updatedAt!: Date;
}

@modelOptions({ schemaOptions: { collection: 'session' } })
class SessionClass {
  @idProp({ required: true })
  public _id!: string;

  @prop({ required: true })
  public expiresAt!: Date;

  @prop({ required: true, unique: true })
  public token!: string;

  @prop({ required: true })
  public createdAt!: Date;

  @prop({ required: true })
  public updatedAt!: Date;

  @prop()
  public ipAddress?: string;

  @prop()
  public userAgent?: string;

  @prop({ required: true })
  public userId!: string;
}

@modelOptions({ schemaOptions: { collection: 'account' } })
class AccountClass {
  @idProp({ required: true })
  public _id!: string;

  @prop({ required: true })
  public accountId!: string;

  @prop({ required: true })
  public providerId!: string;

  @prop({ required: true })
  public userId!: string;

  @prop()
  public accessToken?: string;

  @prop()
  public refreshToken?: string;

  @prop()
  public idToken?: string;

  @prop()
  public accessTokenExpiresAt?: Date;

  @prop()
  public refreshTokenExpiresAt?: Date;

  @prop()
  public scope?: string;

  @prop()
  public password?: string;

  @prop({ required: true })
  public createdAt!: Date;

  @prop({ required: true })
  public updatedAt!: Date;
}

@modelOptions({ schemaOptions: { collection: 'verification' } })
class VerificationClass {
  @idProp({ required: true })
  public _id!: string;

  @prop({ required: true })
  public identifier!: string;

  @prop({ required: true })
  public value!: string;

  @prop({ required: true })
  public expiresAt!: Date;

  @prop()
  public createdAt?: Date;

  @prop()
  public updatedAt?: Date;
}

const User = getModelForClass(UserClass);
const Session = getModelForClass(SessionClass);
const Account = getModelForClass(AccountClass);
const Verification = getModelForClass(VerificationClass);

export { User, Session, Account, Verification };
