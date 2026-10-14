import { en } from './en';
import { es, type Dictionary } from './es';
import { fr } from './fr';
import { ja } from './ja';
import { zh } from './zh';

export type { Dictionary };

/** Idiomas de la interfaz (ADR-0032). `zh` es chino simplificado. */
export const LOCALES = ['es', 'en', 'fr', 'zh', 'ja'] as const;
export type Locale = (typeof LOCALES)[number];
/** El de un perfil nuevo, y el de los textos fuente (`es.ts`). */
export const DEFAULT_LOCALE: Locale = 'es';
/** El de quien llega con el navegador en un idioma que la web no tiene. */
export const FALLBACK_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'senal_locale';

/** Cada idioma con su nombre en ese idioma: así lo reconoce quien lo habla, esté en el que esté. */
export const LOCALE_NAMES: Record<Locale, string> = {
  es: 'Español',
  en: 'English',
  fr: 'Français',
  zh: '简体中文',
  ja: '日本語',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

const dictionaries: Record<Locale, Dictionary> = { es, en, fr, zh, ja };

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

const TAGS: Record<Locale, { html: string; intl: string }> = {
  es: { html: 'es', intl: 'es-ES' },
  en: { html: 'en', intl: 'en-GB' },
  fr: { html: 'fr', intl: 'fr-FR' },
  zh: { html: 'zh-CN', intl: 'zh-CN' },
  ja: { html: 'ja', intl: 'ja-JP' },
};

/** Etiqueta BCP 47 para `Intl` (fechas y números). */
export function intlLocale(locale: Locale): string {
  return TAGS[locale].intl;
}

/** Etiqueta para `lang`: con ella el navegador elige las fuentes y el lector de pantalla, la voz. */
export function htmlLang(locale: Locale): string {
  return TAGS[locale].html;
}

/**
 * El idioma de la interfaz que pide el navegador (cabecera `Accept-Language`), o `null` si no pide
 * ninguno de los que hay. Se respeta su orden de preferencia (`q`) y basta con el idioma, sin la
 * región: `fr-CA` es francés. El chino tradicional (`zh-TW`, `zh-Hant`) cae en el simplificado,
 * que es el que hay. Es el idioma que el usuario tiene puesto, no el país en el que está (ADR-0032).
 */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;
  const ranked = header
    .slice(0, 512)
    .split(',')
    .map((part, index) => {
      const [tag = '', ...params] = part.trim().split(';');
      const q = params.map((param) => param.trim()).find((param) => param.startsWith('q='));
      const weight = q === undefined ? 1 : Number(q.slice(2));
      return { language: tag.trim().toLowerCase().split('-')[0] ?? '', weight, index };
    })
    .filter(({ language, weight }) => language !== '' && Number.isFinite(weight) && weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
  return ranked.map(({ language }) => language).find(isLocale) ?? null;
}
