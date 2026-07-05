import z from 'zod';

const userThemeZod = z.enum(['light', 'dark', 'system']);
export const USER_THEME = userThemeZod.enum;
export const userThemeValidator = userThemeZod.clone().catch(USER_THEME.dark);

export type UserTheme = z.infer<typeof userThemeZod>;
export type AppTheme = Exclude<UserTheme, 'system'>;

export const THEME_COOKIE = 'startername.theme';
