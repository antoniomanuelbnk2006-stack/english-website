import { en } from './en';
import { es, type Dictionary } from './es';

export type { Dictionary };

export const LOCALES = ['es', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'es';
export const LOCALE_COOKIE = 'senal_locale';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

const dictionaries: Record<Locale, Dictionary> = { es, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

/** Rutas con punto a las hojas de texto del diccionario: 'nav.today', 'login.title'… */
type Leaves<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : Leaves<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type TranslationKey = Leaves<Dictionary>;
export type TranslationVars = Record<string, string | number>;
export type Translate = (key: TranslationKey, vars?: TranslationVars) => string;

function lookup(dict: Dictionary, key: string): string {
  let node: unknown = dict;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return key;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : key;
}

/** `t('today.goal', { min: 45 })` → sustituye `{min}` en el texto. */
export function createT(dict: Dictionary): Translate {
  return (key, vars) => {
    const template = lookup(dict, key);
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in vars ? String(vars[name]) : match,
    );
  };
}

/** Etiqueta BCP 47 para `Intl` (fechas y números). */
export function intlLocale(locale: Locale): string {
  return locale === 'es' ? 'es-ES' : 'en-GB';
}
