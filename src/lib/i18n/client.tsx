'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { createT, intlLocale, type Dictionary, type Locale, type Translate } from './index';

interface I18nValue {
  locale: Locale;
  t: Translate;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  locale,
  dictionary,
  children,
}: {
  locale: Locale;
  dictionary: Dictionary;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ locale, t: createT(dictionary) }), [locale, dictionary]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useT se ha usado fuera de <I18nProvider>');
  return value;
}

export function useT(): Translate {
  return useI18n().t;
}

/** Etiqueta para `Intl` según el idioma de la interfaz. */
export function useIntlLocale(): string {
  return intlLocale(useI18n().locale);
}
