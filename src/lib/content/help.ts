import { z } from 'zod';
import { FALLBACK_LOCALE, type Locale } from '@/lib/i18n';

// Las ayudas del contenido en el idioma de quien aprende (ADR-0034): glosario, explicaciones,
// consejos, resúmenes… Lo que se aprende (textos, audios, ejercicios) se hace una vez por idioma
// y lo comparte todo el mundo; las ayudas se escriben en cada idioma de interfaz.
//
// Un campo de ayuda (los `*_es`, por historia: el primer contenido se escribió para
// hispanohablantes) puede ser:
//   - una cadena: el contenido de inglés, con las ayudas en español;
//   - un objeto con una ayuda por idioma de interfaz, con el inglés obligatorio: el contenido
//     nuevo. Al validarlo se convierte en `HelpTranslations`.
// Antes de enseñarlo, el servidor lo resuelve al idioma de la interfaz con `localize`. Los tipos
// que usan las pantallas son los ya resueltos (`Localized<…>`): si a una le llega contenido sin
// resolver, no compila.

/** Una ayuda escrita en varios idiomas de interfaz. */
export class HelpTranslations {
  constructor(readonly texts: Readonly<Partial<Record<Locale, string>>> & { readonly en: string }) {}

  /** La del idioma pedido; si no está, la de inglés. */
  pick(locale: Locale): string {
    return this.texts[locale] ?? this.texts[FALLBACK_LOCALE] ?? this.texts.en;
  }

  /** Al escribirse como JSON (el índice, los scripts), vuelve a ser el objeto de los archivos. */
  toJSON(): HelpTranslations['texts'] {
    return this.texts;
  }
}

/**
 * Esquema de un campo de ayuda: una cadena con las reglas de `base`, o una por idioma de
 * interfaz con las mismas reglas (el inglés, obligatorio).
 */
export function helpText(base: z.ZodString = z.string().min(1)) {
  return z.union([
    base,
    z
      .strictObject({
        en: base,
        es: base.optional(),
        fr: base.optional(),
        zh: base.optional(),
        ja: base.optional(),
      })
      .transform((texts) => new HelpTranslations(texts)),
  ]);
}

/** Una ayuda sin resolver, para mensajes de los scripts y las comprobaciones: la de inglés si hay varias. */
export function helpLabel(value: string | HelpTranslations): string {
  return value instanceof HelpTranslations ? value.texts.en : value;
}

/**
 * El tipo de un contenido con sus ayudas ya resueltas a un idioma: cadenas. El tipo mapeado
 * conserva tal cual las listas y las tuplas.
 */
export type Localized<T> = T extends HelpTranslations
  ? string
  : T extends string | number | boolean | bigint | symbol | null | undefined
    ? T
    : { [K in keyof T]: Localized<T[K]> };

// Cada contenido se resuelve una vez por idioma: el contenido se carga una vez por proceso y
// no cambia, así que se puede recordar el resultado.
const memo = new Map<Locale, WeakMap<object, unknown>>();

/** Resuelve todas las ayudas de `value` (a cualquier profundidad) al idioma `locale`. */
export function localize<T>(value: T, locale: Locale): Localized<T> {
  if (value instanceof HelpTranslations) return value.pick(locale) as Localized<T>;
  if (typeof value !== 'object' || value === null) return value as Localized<T>;

  let seen = memo.get(locale);
  if (!seen) {
    seen = new WeakMap();
    memo.set(locale, seen);
  }
  const cached = seen.get(value);
  if (cached !== undefined) return cached as Localized<T>;

  const result = Array.isArray(value)
    ? value.map((item: unknown) => localize(item, locale))
    : Object.fromEntries(Object.entries(value).map(([key, item]) => [key, localize(item, locale)]));
  seen.set(value, result);
  return result as Localized<T>;
}
