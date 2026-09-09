import { em } from 'enumwaii';
import z from 'zod';

export const userThemeEnum = em({
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system',
});
export const USER_THEME = userThemeEnum.enum;
const USER_THEME_WIRE = userThemeEnum.rawEnum;
export const userThemeCookieSchema = z.enum(USER_THEME_WIRE).catch(USER_THEME_WIRE.DARK);
export const appThemeEnum = userThemeEnum.pick([USER_THEME.LIGHT, USER_THEME.DARK]);
const userThemeZod = z.enum(USER_THEME);

export const userThemeValidator = userThemeZod.clone().catch(USER_THEME.DARK);

export type UserTheme = z.infer<typeof userThemeZod>;
export type AppTheme = (typeof appThemeEnum)['~type'];

export const THEME_COOKIE = 'startername.theme';
