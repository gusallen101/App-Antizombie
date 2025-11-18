import AsyncStorage from '@react-native-async-storage/async-storage';
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

import { translations, type TranslationDictionary } from '@/localization/translations';

type SupportedLanguage = 'en' | 'es';

type LocalizationContextValue = {
  language: SupportedLanguage;
  setLanguage: (language: SupportedLanguage) => void;
  availableLanguages: SupportedLanguage[];
  t: (key: string, replacements?: Record<string, string | number>) => string;
};

const LocalizationContext = createContext<LocalizationContextValue | undefined>(undefined);

const languageOptions: SupportedLanguage[] = ['en', 'es'];

const applyReplacements = (
  value: string,
  replacements?: Record<string, string | number>,
): string => {
  if (!replacements) {
    return value;
  }

  return Object.entries(replacements).reduce((acc, [placeholder, replacement]) => {
    const pattern = new RegExp(`{{\\s*${placeholder}\\s*}}`, 'g');
    return acc.replace(pattern, String(replacement));
  }, value);
};

const LANGUAGE_STORAGE_KEY = '@app-language:selected';

const getValueFromDictionary = (dictionary: TranslationDictionary, path: string[]): string | null => {
  return path.reduce<string | TranslationDictionary | null>((current, segment) => {
    if (current && typeof current === 'object' && segment in current) {
      return current[segment] as string | TranslationDictionary;
    }

    return null;
  }, dictionary) as string | null;
};

type Props = {
  children: ReactNode;
};

export function LocalizationProvider({ children }: Props) {
  const [language, setLanguage] = useState<SupportedLanguage>('en');
  const isHydrated = useRef(false);

  useEffect(() => {
    const hydrateLanguage = async () => {
      try {
        const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (stored === 'en' || stored === 'es') {
          setLanguage(stored);
        } else {
          const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? 'es';
          const fallback = locale.toLowerCase().startsWith('en') ? 'en' : 'es';
          setLanguage(fallback);
        }
      } catch (error) {
        console.warn('Failed to hydrate language from storage', error);
      } finally {
        isHydrated.current = true;
      }
    };

    void hydrateLanguage();
  }, []);

  const translate = useCallback(
    (key: string, replacements?: Record<string, string | number>): string => {
      const path = key.split('.');
      const dictionary = translations[language];
      const fallbackDictionary = translations.es;

      const localizedValue = getValueFromDictionary(dictionary, path);

      if (typeof localizedValue === 'string') {
        return applyReplacements(localizedValue, replacements);
      }

      const fallbackValue = getValueFromDictionary(fallbackDictionary, path);

      if (typeof fallbackValue === 'string') {
        return applyReplacements(fallbackValue, replacements);
      }

      return key;
    },
    [language],
  );

  const handleSetLanguage = useCallback(
    (selected: SupportedLanguage) => {
      setLanguage(selected);
      if (isHydrated.current) {
        AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, selected).catch((error) => {
          console.warn('Failed to persist language selection', error);
        });
      }
    },
    [],
  );

  const value = useMemo<LocalizationContextValue>(
    () => ({
      language,
      setLanguage: handleSetLanguage,
      availableLanguages: languageOptions,
      t: translate,
    }),
    [handleSetLanguage, language, translate],
  );

  return <LocalizationContext.Provider value={value}>{children}</LocalizationContext.Provider>;
}

export function useLocalization() {
  const context = useContext(LocalizationContext);

  if (!context) {
    throw new Error('useLocalization must be used within a LocalizationProvider');
  }

  return context;
}

