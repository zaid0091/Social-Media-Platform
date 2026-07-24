'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import en from './en.json';
import es from './es.json';
import ar from './ar.json';

const DICTIONARIES = { en, es, ar };

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState('en');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Detect stored preference or browser Accept-Language header fallback
    const savedLocale = localStorage.getItem('locale');
    if (savedLocale && DICTIONARIES[savedLocale]) {
      setLocale(savedLocale);
    } else {
      const browserLang = navigator.language?.split('-')[0];
      if (browserLang && DICTIONARIES[browserLang]) {
        setLocale(browserLang);
      } else {
        setLocale('en');
      }
    }
  }, []);

  const setLocale = (newLocale) => {
    if (!DICTIONARIES[newLocale]) return;
    setLocaleState(newLocale);
    localStorage.setItem('locale', newLocale);

    // Apply RTL/LTR dir attribute and language tag directly to root document element
    const dir = newLocale === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dir = dir;
    document.documentElement.lang = newLocale;
  };

  const t = (key) => {
    const dict = DICTIONARIES[locale] || DICTIONARIES['en'];
    return dict[key] || key;
  };

  // Locale-aware formatting helper utilities conforming to standards
  const formatDate = (date, options = {}) => {
    return new Intl.DateTimeFormat(locale, options).format(new Date(date));
  };

  const formatNumber = (num, options = {}) => {
    return new Intl.NumberFormat(locale, options).format(num);
  };

  const contextValue = {
    locale,
    setLocale,
    t,
    formatDate,
    formatNumber,
    isRTL: locale === 'ar'
  };

  return (
    <I18nContext.Provider value={contextValue}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    // Return mock helpers during SSR pre-renders
    return {
      locale: 'en',
      setLocale: () => {},
      t: (key) => key,
      formatDate: (d) => String(d),
      formatNumber: (n) => String(n),
      isRTL: false
    };
  }
  return context;
}
