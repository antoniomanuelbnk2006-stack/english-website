import { describe, expect, it } from 'vitest';
import { en } from './en';
import { es } from './es';
import { createT, getDictionary, isLocale, type TranslationKey } from './index';

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

describe('diccionarios', () => {
  it('es y en tienen exactamente las mismas claves', () => {
    expect(leaves(en).sort()).toEqual(leaves(es).sort());
  });

  it('cada texto usa las mismas variables en los dos idiomas', () => {
    const tEs = createT(es);
    const tEn = createT(en);
    for (const key of leaves(es) as TranslationKey[]) {
      expect(placeholders(tEn(key)), key).toEqual(placeholders(tEs(key)));
    }
  });

  it('ningún texto está vacío', () => {
    for (const dict of [es, en]) {
      const t = createT(dict);
      for (const key of leaves(dict) as TranslationKey[]) expect(t(key).trim(), key).not.toBe('');
    }
  });

  it('isLocale y getDictionary', () => {
    expect(isLocale('es')).toBe(true);
    expect(isLocale('fr')).toBe(false);
    expect(getDictionary('en')).toBe(en);
  });
});
