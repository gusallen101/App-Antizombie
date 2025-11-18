import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationDefaultTheme,
  ThemeProvider as NavigationThemeProvider,
  type Theme,
} from '@react-navigation/native';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme as useDeviceColorScheme } from 'react-native';

import { defaultPalette, type Palette } from '@/constants/theme';

type Scheme = 'light' | 'dark';

type PaletteOverrides = Partial<Record<Scheme, Partial<Palette>>>;

type ThemeContextValue = {
  colorScheme: Scheme;
  palette: Palette;
  setColorScheme: (scheme: Scheme) => void;
  updatePalette: (scheme: Scheme, overrides: Partial<Palette>) => void;
  resetPalette: (scheme?: Scheme) => void;
};

const AppThemeContext = createContext<ThemeContextValue | undefined>(undefined);

type Props = {
  children: ReactNode;
};

const STORAGE_KEYS = {
  scheme: '@app-theme:scheme',
  overrides: '@app-theme:overrides',
};

export function AppThemeProvider({ children }: Props) {
  const systemScheme = useDeviceColorScheme();
  const [colorScheme, setColorScheme] = useState<Scheme>(systemScheme === 'dark' ? 'dark' : 'light');
  const [paletteOverrides, setPaletteOverrides] = useState<PaletteOverrides>({});
  const isHydrated = useRef(false);

  useEffect(() => {
    const hydrateTheme = async () => {
      try {
        const storedScheme = await AsyncStorage.getItem(STORAGE_KEYS.scheme);
        if (storedScheme === 'light' || storedScheme === 'dark') {
          setColorScheme(storedScheme);
        }

        const storedOverrides = await AsyncStorage.getItem(STORAGE_KEYS.overrides);
        if (storedOverrides) {
          const parsed = JSON.parse(storedOverrides) as PaletteOverrides;
          setPaletteOverrides(parsed);
        }
      } catch (error) {
        console.warn('Failed to hydrate theme from storage', error);
      } finally {
        isHydrated.current = true;
      }
    };

    void hydrateTheme();
  }, []);

  const palette = useMemo<Palette>(() => {
    const overrides = paletteOverrides[colorScheme] ?? {};

    return {
      ...defaultPalette[colorScheme],
      ...overrides,
    };
  }, [colorScheme, paletteOverrides]);

  const navigationTheme = useMemo<Theme>(() => {
    const baseTheme = colorScheme === 'dark' ? NavigationDarkTheme : NavigationDefaultTheme;

    return {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        primary: palette.primary,
        background: palette.background,
        card: palette.headerBackground,
        text: palette.textPrimary,
        border: palette.border,
        notification: palette.accent,
      },
    };
  }, [colorScheme, palette]);

  const persistColorScheme = useCallback(async (scheme: Scheme) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.scheme, scheme);
    } catch (error) {
      console.warn('Failed to persist color scheme', error);
    }
  }, []);

  const persistOverrides = useCallback(async (overrides: PaletteOverrides) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.overrides, JSON.stringify(overrides));
    } catch (error) {
      console.warn('Failed to persist palette overrides', error);
    }
  }, []);

  const handleSetColorScheme = useCallback(
    (scheme: Scheme) => {
      setColorScheme(scheme);
      if (isHydrated.current) {
        void persistColorScheme(scheme);
      }
    },
    [persistColorScheme],
  );

  const handleUpdatePalette = useCallback(
    (scheme: Scheme, overrides: Partial<Palette>) => {
      setPaletteOverrides((current) => {
        const nextOverrides = {
          ...current,
          [scheme]: {
            ...current[scheme],
            ...overrides,
          },
        };

        if (isHydrated.current) {
          void persistOverrides(nextOverrides);
        }

        return nextOverrides;
      });
    },
    [persistOverrides],
  );

  const handleResetPalette = useCallback(
    (scheme?: Scheme) => {
      setPaletteOverrides((current) => {
        let nextOverrides: PaletteOverrides;

        if (!scheme) {
          nextOverrides = {};
        } else {
          const { [scheme]: _toRemove, ...rest } = current;
          nextOverrides = rest;
        }

        if (isHydrated.current) {
          void persistOverrides(nextOverrides);
        }

        return nextOverrides;
      });
    },
    [persistOverrides],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      colorScheme,
      palette,
      setColorScheme: handleSetColorScheme,
      updatePalette: handleUpdatePalette,
      resetPalette: handleResetPalette,
    }),
    [colorScheme, palette, handleSetColorScheme, handleUpdatePalette, handleResetPalette],
  );

  return (
    <AppThemeContext.Provider value={value}>
      <NavigationThemeProvider value={navigationTheme}>{children}</NavigationThemeProvider>
    </AppThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(AppThemeContext);

  if (!context) {
    throw new Error('useAppTheme must be used within an AppThemeProvider');
  }

  return context;
}

