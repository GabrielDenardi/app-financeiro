import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationDefaultTheme,
  type Theme as NavigationTheme,
} from '@react-navigation/native';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { getColors, type AppColors, type ThemeMode } from './colors';

const THEME_STORAGE_KEY = 'app-financeiro:theme-mode';

type AppThemeContextValue = {
  colors: AppColors;
  isDarkMode: boolean;
  mode: ThemeMode;
  navigationTheme: NavigationTheme;
  setDarkMode: (enabled: boolean) => void;
  toggleDarkMode: () => void;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

function createNavigationTheme(mode: ThemeMode, colors: AppColors): NavigationTheme {
  const baseTheme = mode === 'dark' ? NavigationDarkTheme : NavigationDefaultTheme;

  return {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: colors.primaryLight,
      background: colors.background,
      card: colors.surface,
      text: colors.textPrimary,
      border: colors.border,
      notification: colors.danger,
    },
  };
}

export function AppThemeProvider({ children }: PropsWithChildren) {
  const [mode, setMode] = useState<ThemeMode>('light');

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((storedMode) => {
        if (storedMode === 'dark' || storedMode === 'light') {
          setMode(storedMode);
        }
      })
      .catch(() => undefined);
  }, []);

  const persistMode = useCallback((nextMode: ThemeMode) => {
    setMode(nextMode);
    AsyncStorage.setItem(THEME_STORAGE_KEY, nextMode).catch(() => undefined);
  }, []);

  const setDarkMode = useCallback(
    (enabled: boolean) => {
      persistMode(enabled ? 'dark' : 'light');
    },
    [persistMode],
  );

  const toggleDarkMode = useCallback(() => {
    persistMode(mode === 'dark' ? 'light' : 'dark');
  }, [mode, persistMode]);

  const colors = useMemo(() => getColors(mode), [mode]);
  const navigationTheme = useMemo(() => createNavigationTheme(mode, colors), [colors, mode]);

  const value = useMemo<AppThemeContextValue>(
    () => ({
      colors,
      isDarkMode: mode === 'dark',
      mode,
      navigationTheme,
      setDarkMode,
      toggleDarkMode,
    }),
    [colors, mode, navigationTheme, setDarkMode, toggleDarkMode],
  );

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(AppThemeContext);

  if (!context) {
    throw new Error('useAppTheme must be used within AppThemeProvider.');
  }

  return context;
}

export function useThemeColors() {
  return useAppTheme().colors;
}
