"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { en } from './en';
import { id as idDict } from './id';

type Locale = 'en' | 'id';

type I18nContextType = {
  locale: Locale;
  t: (key: string, fallback?: string) => string;
  setLocale: (loc: Locale) => void;
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const DICTS: Record<Locale, Record<string, string>> = {
  en,
  id: idDict,
};

type I18nProviderProps = {
  children: React.ReactNode;
  storageKey?: string;
};

function readStoredLocale(storageKey: string): Locale {
  if (typeof window === 'undefined') return 'en';
  try {
    const saved = localStorage.getItem(storageKey);
    return saved === 'en' || saved === 'id' ? saved : 'en';
  } catch {
    return 'en';
  }
}

export function I18nProvider({ children, storageKey = 'app_locale' }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(() => readStoredLocale(storageKey));

  const setLocale = useCallback((loc: Locale) => {
    setLocaleState(loc);
    // Only access localStorage on client side
    if (typeof window === 'undefined') return;
    
    try { localStorage.setItem(storageKey, loc); } catch {}
  }, [storageKey]);

  const dict = DICTS[locale] || en;

  const t = useMemo(() => {
    return (key: string, fallback?: string) => {
      return dict[key] ?? fallback ?? key;
    };
  }, [dict]);

  const value = useMemo(() => ({ locale, t, setLocale }), [locale, t, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

