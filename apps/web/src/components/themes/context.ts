import { createContext } from 'react';

import type { AppTheme, UserTheme } from './constants';

interface iThemeContextProps {
  userTheme: UserTheme;
  appTheme: AppTheme;
  setTheme: (theme: UserTheme) => void;
}

export const ThemeContext = createContext<iThemeContextProps | undefined>(undefined);
