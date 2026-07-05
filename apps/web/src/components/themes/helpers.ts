import { createServerFn } from '@tanstack/react-start';
import { getCookie, setCookie } from '@tanstack/react-start/server';

import { isOnClient } from '@~/utils/ssr-helpers';

import { THEME_COOKIE, USER_THEME, userThemeValidator } from './constants';
import type { AppTheme, UserTheme } from './constants';

export const getStoredTheme = createServerFn().handler(async () => userThemeValidator.parse(getCookie(THEME_COOKIE)));

export function getInitialThemeClass(theme: UserTheme): Exclude<UserTheme, typeof USER_THEME.system> {
  if (theme === USER_THEME.system) {
    // During SSR, default to light; client will adjust if needed
    return USER_THEME.dark;
  }
  return theme;
}

export const setStoredTheme = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => userThemeValidator.parse(data))
  .handler(({ data }) => {
    setCookie(THEME_COOKIE, data);
  });

export function getSystemTheme(): AppTheme {
  if (isOnClient) return USER_THEME.dark;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? USER_THEME.dark : USER_THEME.light;
}

export function handleThemeChange(theme: UserTheme) {
  const root = document.documentElement;
  root.classList.remove(USER_THEME.light, USER_THEME.dark);
  const newTheme = theme === USER_THEME.system ? getSystemTheme() : theme;
  root.classList.add(newTheme);
}

export function setupPreferredListener() {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => handleThemeChange(USER_THEME.system);
  mediaQuery.addEventListener('change', handler);
  return () => mediaQuery.removeEventListener('change', handler);
}
