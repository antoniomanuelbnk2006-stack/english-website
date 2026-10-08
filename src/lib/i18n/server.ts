import 'server-only';
import { cookies } from 'next/headers';
import { cache } from 'react';
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  createT,
  getDictionary,
  isLocale,
  type Locale,
  type Translate,
} from './index';

/** Idioma de la interfaz: lo guarda Ajustes en una cookie (y en profiles.ui_locale). */
export const getLocale = cache(async (): Promise<Locale> => {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
});

export const getT = cache(async (): Promise<Translate> =>
  createT(getDictionary(await getLocale())),
);
