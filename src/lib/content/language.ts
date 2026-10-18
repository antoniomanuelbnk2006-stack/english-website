import { htmlLang, intlLocale, LOCALES, type Locale } from '@/lib/i18n';

// El idioma de cada contenido (ADR-0035). Se practican los mismos cinco idiomas que tiene la
// interfaz (ADR-0032).
//
// - El inglés, el primero que hubo, sigue en la raíz de `content/` y sus ids no llevan prefijo
//   (`a1-rea-001`, `a1.present-simple`).
// - Los demás van en `content/<idioma>/`, con la misma estructura, y sus ids llevan el idioma
//   delante (`es-a1-rea-001`, `es.a1.ser-estar`).

/** Idiomas que se pueden practicar. */
export const PRACTICE_LANGUAGES = LOCALES;
export type PracticeLanguage = Locale;

/** El idioma del contenido de la raíz de `content/`. */
export const BASE_LANGUAGE = 'en' satisfies PracticeLanguage;

/** Los idiomas que van en su propia carpeta y llevan prefijo en el id. */
export const PREFIXED_LANGUAGES = PRACTICE_LANGUAGES.filter(
  (language): language is Exclude<PracticeLanguage, typeof BASE_LANGUAGE> =>
    language !== BASE_LANGUAGE,
);

/** Parte de una expresión regular: el prefijo de idioma opcional de un id con guion. */
export const DASH_PREFIX = `(?:(?:${PREFIXED_LANGUAGES.join('|')})-)?`;
/** Igual, para los ids con punto (las fichas de gramática). */
export const DOT_PREFIX = `(?:(?:${PREFIXED_LANGUAGES.join('|')})\\.)?`;

const PREFIX = new RegExp(`^(${PREFIXED_LANGUAGES.join('|')})[-.]`);

/** El idioma de un contenido según su id: `es-a1-rea-001` → español; sin prefijo, inglés. */
export function languageOfId(id: string): PracticeLanguage {
  const match = PREFIX.exec(id);
  return (match?.[1] as PracticeLanguage | undefined) ?? BASE_LANGUAGE;
}

/** La etiqueta `lang` del contenido con ese id (`es-a1-rea-001` → `es`). */
export function contentLang(id: string): string {
  return htmlLang(languageOfId(id));
}

/** El nombre de un idioma en el de la interfaz, con mayúscula: «Inglés», «English», «英语». */
export function languageName(language: PracticeLanguage, locale: Locale): string {
  const tag = intlLocale(locale);
  const name = new Intl.DisplayNames([tag], { type: 'language' }).of(language) ?? language;
  return name.charAt(0).toLocaleUpperCase(tag) + name.slice(1);
}

/** Solo lo de un idioma: los contenidos cuyo id es de `language` (ADR-0036). */
export function inLanguage<T extends { id: string }>(
  items: readonly T[],
  language: PracticeLanguage,
): T[] {
  return items.filter((item) => languageOfId(item.id) === language);
}

/** El id sin el prefijo de idioma:`es-a1-rea-001` → `a1-rea-001`, `es.a1.ser-estar` → `a1.ser-estar`. */
export function withoutLanguage(id: string): string {
  return id.replace(PREFIX, '');
}

/**
 * Comprueba que un contenido está en la carpeta de su idioma: un id con `es-` delante solo puede
 * estar en `content/es/`, y uno sin prefijo, en la raíz. Lanza un error legible si no.
 */
export function assertLanguage(id: string, language: PracticeLanguage, file: string): void {
  const fromId = languageOfId(id);
  if (fromId !== language) {
    throw new Error(
      `${file}: el id «${id}» es de ${fromId}, pero el archivo está en la carpeta de ${language}`,
    );
  }
}
