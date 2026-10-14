import { describe, expect, it } from 'vitest';
import { es } from './es';
import {
  LOCALES,
  LOCALE_NAMES,
  createT,
  getDictionary,
  htmlLang,
  intlLocale,
  isLocale,
  localeFromAcceptLanguage,
  type TranslationKey,
} from './index';

/** Todas las rutas a hojas de un diccionario, para comparar idiomas en tiempo de ejecución. */
function leaves(node: unknown, prefix = ''): string[] {
  if (typeof node === 'string') return [prefix];
  if (typeof node !== 'object' || node === null) return [];
  return Object.entries(node).flatMap(([key, value]) =>
    leaves(value, prefix ? `${prefix}.${key}` : key),
  );
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('createT', () => {
  const t = createT(es);

  it('devuelve el texto de una clave anidada', () => {
    expect(t('nav.today')).toBe('Hoy');
  });

  it('interpola variables y deja intactas las que no recibe', () => {
    expect(t('today.goalProgress', { done: 18, goal: 45 })).toBe('18 de 45 min');
    expect(t('today.goalProgress', { done: 18 })).toBe('18 de {goal} min');
  });

  it('si la clave no existe devuelve la propia clave', () => {
    expect(t('no.existe' as TranslationKey)).toBe('no.existe');
  });
});

// ADR-0032: cinco idiomas de interfaz, todos con los mismos textos que el español.
describe.each(LOCALES.filter((locale) => locale !== 'es'))('diccionario %s', (locale) => {
  const dict = getDictionary(locale);

  it('tiene exactamente las mismas claves que es', () => {
    expect(leaves(dict).sort()).toEqual(leaves(es).sort());
  });

  it('cada texto usa las mismas variables que en es', () => {
    const tEs = createT(es);
    const t = createT(dict);
    for (const key of leaves(es) as TranslationKey[]) {
      expect(placeholders(t(key)), key).toEqual(placeholders(tEs(key)));
    }
  });

  it('ningún texto está vacío', () => {
    const t = createT(dict);
    for (const key of leaves(dict) as TranslationKey[]) expect(t(key).trim(), key).not.toBe('');
  });
});

describe('idiomas', () => {
  it('isLocale reconoce los cinco y nada más', () => {
    for (const locale of ['es', 'en', 'fr', 'zh', 'ja']) expect(isLocale(locale)).toBe(true);
    for (const other of ['de', 'pt', 'zh-CN', 'ES', '', null, 3])
      expect(isLocale(other)).toBe(false);
  });

  it('cada uno tiene su nombre, su etiqueta para lang y la de Intl', () => {
    expect(LOCALE_NAMES).toEqual({
      es: 'Español',
      en: 'English',
      fr: 'Français',
      zh: '简体中文',
      ja: '日本語',
    });
    expect(LOCALES.map(htmlLang)).toEqual(['es', 'en', 'fr', 'zh-CN', 'ja']);
    expect(LOCALES.map(intlLocale)).toEqual(['es-ES', 'en-GB', 'fr-FR', 'zh-CN', 'ja-JP']);
  });
});

describe('localeFromAcceptLanguage', () => {
  it.each([
    ['es-ES,es;q=0.9,en;q=0.8', 'es'],
    ['fr-CA', 'fr'],
    ['ja', 'ja'],
    ['zh-CN,zh;q=0.9', 'zh'],
    ['en-US,en;q=0.9', 'en'],
  ])('%s → %s', (header, locale) => {
    expect(localeFromAcceptLanguage(header)).toBe(locale);
  });

  it('el chino tradicional cae en el simplificado, que es el que hay', () => {
    expect(localeFromAcceptLanguage('zh-TW,zh-Hant;q=0.9')).toBe('zh');
  });

  it('respeta el orden de preferencia, no el orden en la cabecera', () => {
    expect(localeFromAcceptLanguage('en;q=0.5,fr;q=0.9')).toBe('fr');
    expect(localeFromAcceptLanguage('de-DE,de;q=0.9,ja;q=0.8,en;q=0.7')).toBe('ja');
  });

  it('a igual preferencia, gana el primero', () => {
    expect(localeFromAcceptLanguage('ja,fr')).toBe('ja');
  });

  it('ignora lo que no quiere (q=0), el comodín y lo mal escrito', () => {
    expect(localeFromAcceptLanguage('fr;q=0,en;q=0.1')).toBe('en');
    expect(localeFromAcceptLanguage('*;q=0.5')).toBeNull();
    expect(localeFromAcceptLanguage('fr;q=abc,ja')).toBe('ja');
  });

  it('sin ninguno de los cinco, o sin cabecera, no elige', () => {
    expect(localeFromAcceptLanguage('de-DE,it;q=0.8')).toBeNull();
    expect(localeFromAcceptLanguage('')).toBeNull();
    expect(localeFromAcceptLanguage(null)).toBeNull();
    expect(localeFromAcceptLanguage(undefined)).toBeNull();
  });
});
