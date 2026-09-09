import { createServerFn } from '@tanstack/react-start';
import { getCookie, setCookie } from '@tanstack/react-start/server';

import { isOnClient } from '@~/utils/ssr-helpers';

import type { AppTheme, UserTheme } from './constants';
import { appThemeEnum, THEME_COOKIE, USER_THEME, userThemeCookieSchema } from './constants';

export const getStoredTheme = createServerFn().handler(async () =>
  userThemeCookieSchema.parse(getCookie(THEME_COOKIE)),
);

export function getInitialThemeClass(theme: UserTheme): AppTheme {
  if (theme === USER_THEME.SYSTEM) {
    // During SSR, default to light; client will adjust if needed
    return USER_THEME.DARK;
  }
  return appThemeEnum.parse(theme);
}

export const setStoredTheme = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => userThemeCookieSchema.parse(data))
  .handler(({ data }) => {
    setCookie(THEME_COOKIE, data);
  });

export function getSystemTheme(): AppTheme {
  if (isOnClient) return USER_THEME.DARK;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? USER_THEME.DARK : USER_THEME.LIGHT;
}

export function handleThemeChange(theme: UserTheme) {
  const root = document.documentElement;
  root.classList.remove(USER_THEME.LIGHT, USER_THEME.DARK);
  const newTheme = theme === USER_THEME.SYSTEM ? getSystemTheme() : theme;
  root.classList.add(newTheme);
}

export function setupPreferredListener() {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => handleThemeChange(USER_THEME.SYSTEM);
  mediaQuery.addEventListener('change', handler);
  return () => mediaQuery.removeEventListener('change', handler);
}
