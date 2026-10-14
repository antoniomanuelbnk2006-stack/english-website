import 'server-only';
import { cache } from 'react';
import { getUiPreferences } from '@/lib/preferences';
import { createT, getDictionary, type Locale, type Translate } from './index';

/**
 * Idioma de la interfaz: el de la cookie de preferencias o, sin ella, el del perfil
 * (src/lib/preferences.ts).
 */
export const getLocale = cache(async (): Promise<Locale> => (await getUiPreferences()).locale);

export const getT = cache(async (): Promise<Translate> =>
  createT(getDictionary(await getLocale())),
);
