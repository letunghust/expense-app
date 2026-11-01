import { getLocales } from 'expo-localization';
import { createContext, type ReactNode, use, useEffect, useState } from 'react';

import { secureStorage } from '@/lib/secure-storage';

import { en } from './en';
import { ja } from './ja';
import { ko } from './ko';
import { type Strings, vi } from './vi';
import { zh } from './zh';

export type { Strings };

export const LANGUAGES = ['vi', 'en', 'ko', 'zh', 'ja'] as const;
export type Language = (typeof LANGUAGES)[number];
/** What the user picked: a language, or whatever the phone is set to. */
export type LanguageSetting = Language | 'system';

const DICTIONARIES: Record<Language, Strings> = { vi, en, ko, zh, ja };
const STORAGE_KEY = 'app.language';

let current: Language = 'vi';

/**
 * Strings of the current language, for code outside components (formatting
 * helpers, dialogs, errors). Components use `useStrings()` so they re-render
 * when the language changes.
 */
export function strings(): Strings {
  return DICTIONARIES[current];
}

/** Switches the strings that `strings()` returns; the provider calls it, tests may too. */
export function setStringsLanguage(language: Language) {
  current = language;
}

export function stringsFor(language: Language): Strings {
  return DICTIONARIES[language];
}

/** The phone's first supported language; English for any other language. */
export function deviceLanguage(): Language {
  for (const locale of getLocales()) {
    const code = locale.languageCode as Language | null;
    if (code && LANGUAGES.includes(code)) return code;
  }
  return 'en';
}

type I18n = {
  language: Language;
  setting: LanguageSetting;
  t: Strings;
  setLanguageSetting: (setting: LanguageSetting) => Promise<void>;
};

const I18nContext = createContext<I18n | null>(null);

const resolve = (setting: LanguageSetting): Language => (setting === 'system' ? deviceLanguage() : setting);

/**
 * Loads the saved language before showing the app, so it never flashes in the
 * wrong one. Without a saved choice the app is in Vietnamese: many Vietnamese
 * users keep their phone in English and would not expect the app to switch.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [setting, setSetting] = useState<LanguageSetting | null>(null);

  useEffect(() => {
    secureStorage
      .getItem(STORAGE_KEY)
      .catch(() => null)
      .then((saved) => {
        const loaded = saved === 'system' || LANGUAGES.includes(saved as Language) ? (saved as LanguageSetting) : 'vi';
        setStringsLanguage(resolve(loaded));
        setSetting(loaded);
      });
  }, []);

  if (setting == null) return null;
  const language = resolve(setting);

  const value: I18n = {
    language,
    setting,
    t: DICTIONARIES[language],
    setLanguageSetting: async (next) => {
      await secureStorage.setItem(STORAGE_KEY, next);
      setStringsLanguage(resolve(next));
      setSetting(next);
    },
  };
  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n(): I18n {
  const i18n = use(I18nContext);
  if (!i18n) throw new Error('useI18n must be used inside <I18nProvider>');
  return i18n;
}

/** The current language's strings; the component re-renders when it changes. */
export function useStrings(): Strings {
  return useI18n().t;
}
