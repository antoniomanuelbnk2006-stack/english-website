import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { LOCALES, type Locale } from '@/lib/i18n';
import { helpText, type Localized } from './help';
import { withoutLanguage } from './language';
import { Cefr, GrammarId } from './schema';

// Fichas de gramática: `content/grammar/{nivel}/{id}.mdx`
// (docs/01-pedagogia/06-gramatica.md §2). La explicación va en el cuerpo MDX; lo que la app
// necesita como datos (ejemplos y mini-práctica) va en el frontmatter para poder validarlo.

/** Ítem de la mini-práctica: una frase con un hueco (`___`) y lo que vale en él. */
export const PracticeItem = z.object({
  id: z.string().regex(/^p\d{1,2}$/),
  /** Frase con el hueco marcado con `___` y, entre paréntesis, la pista si hace falta. */
  prompt: z
    .string()
    .min(1)
    .refine((text) => text.includes('___'), 'el hueco se marca con ___'),
  /** Respuestas válidas; la primera es la que se enseña al corregir. */
  answers: z.array(z.string().min(1)).min(1),
  /** La regla en una línea: por qué es esa la respuesta. */
  rule_es: helpText(),
});
export type RawPracticeItem = z.infer<typeof PracticeItem>;
export type PracticeItem = Localized<RawPracticeItem>;

/**
 * Un ejemplo: la frase en el idioma que se aprende y su traducción, que es una ayuda (ADR-0034).
 * En el contenido nuevo van en `text` y `translation` (una por idioma de interfaz); las fichas de
 * inglés los tienen en `en` y `es`. Las dos formas se leen igual: `text` y `translation`.
 */
export const GrammarExample = z.union([
  z.strictObject({ text: z.string().min(1), translation: helpText() }),
  z
    .strictObject({ en: z.string().min(1), es: z.string().min(1) })
    .transform(({ en, es }) => ({ text: en, translation: es })),
]);

export const GrammarMeta = z.object({
  id: GrammarId,
  level: Cefr,
  title: z.string().min(1),
  summary_es: helpText(),
  skills: z.array(z.enum(['listening', 'reading', 'writing', 'speaking'])).min(1),
  related: z.array(GrammarId).default([]),
  examples: z.array(GrammarExample).min(2),
  practice: z.array(PracticeItem).length(5),
  /**
   * Idioma del cuerpo de este archivo: es una ayuda (ADR-0034). Las fichas de inglés están en
   * español; las de los demás idiomas, en inglés. Las versiones en otros idiomas de interfaz van
   * en `<id>.<idioma>.mdx`, junto a esta, solo con el cuerpo.
   */
  body_locale: z.enum(LOCALES).default('es'),
});
export type RawGrammarMeta = z.infer<typeof GrammarMeta>;
export type GrammarMeta = Localized<RawGrammarMeta>;

/**
 * Secciones que toda ficha lleva en el cuerpo, en este orden, según el idioma del cuerpo. El
 * contraste es con la lengua de quien lee: la de la interfaz.
 */
export const GRAMMAR_SECTIONS_BY_LOCALE: Record<Locale, readonly string[]> = {
  es: ['En una frase', 'Forma', 'Uso', 'Contraste con el español', 'Errores típicos', 'Cómo suena'],
  en: ['In one sentence', 'Form', 'Use', 'Contrast with English', 'Common mistakes', 'How it sounds'],
  fr: [
    'En une phrase',
    'Forme',
    'Emploi',
    'Contraste avec le français',
    'Erreurs fréquentes',
    'Prononciation',
  ],
  zh: ['一句话', '形式', '用法', '与中文对比', '常见错误', '发音'],
  ja: ['ひとことで', '形', '使い方', '日本語との比較', 'よくある間違い', '発音'],
};

/** Las del español, que son las de todas las fichas de inglés. */
export const GRAMMAR_SECTIONS = GRAMMAR_SECTIONS_BY_LOCALE.es;

const VARIANT = new RegExp(`^(.+)\\.(${LOCALES.join('|')})$`);

/**
 * Si el nombre de un archivo de gramática (sin `.mdx`) es la versión en otro idioma de una ficha
 * (`es.a1.ser-estar.fr`), su ficha y su idioma; si es una ficha, `null`.
 */
export function fichaVariant(name: string): { id: string; locale: Locale } | null {
  const match = VARIANT.exec(name);
  return match?.[1] && match[2] ? { id: match[1], locale: match[2] as Locale } : null;
}

/** Una ficha tal cual está en el archivo (ayudas sin resolver). */
export interface ParsedFicha {
  meta: RawGrammarMeta;
  /** Cuerpo MDX, sin el frontmatter. */
  body: string;
}

/** Separa y valida el frontmatter de una ficha. Lanza un error legible si no cumple. */
export function parseFicha(source: string): ParsedFicha {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(source);
  if (!match) throw new Error('falta el frontmatter (--- … ---) al principio de la ficha');
  const meta = GrammarMeta.parse(parseYaml(match[1] ?? ''));
  return { meta, body: match[2] ?? '' };
}

/** Comprobaciones que el esquema no puede expresar. Devuelve los problemas encontrados. */
export function checkFicha(ficha: ParsedFicha, expected: { id: string; level: string }): string[] {
  const issues: string[] = [];
  const { meta, body } = ficha;

  if (meta.id !== expected.id) issues.push(`el id «${meta.id}» no coincide con el fichero`);
  if (meta.level.toLowerCase() !== expected.level) {
    issues.push(`el nivel ${meta.level} no coincide con la carpeta ${expected.level}`);
  }
  if (!withoutLanguage(meta.id).startsWith(`${meta.level.toLowerCase()}.`)) {
    issues.push(`el id debe empezar por «${meta.level.toLowerCase()}.»`);
  }

  const ids = meta.practice.map((item) => item.id);
  if (new Set(ids).size !== ids.length) issues.push('hay ítems de práctica con el mismo id');
  for (const item of meta.practice) {
    if ((item.prompt.match(/___/g) ?? []).length !== 1) {
      issues.push(`${item.id}: cada ítem lleva un solo hueco`);
    }
  }

  issues.push(...checkFichaBody(body, meta.body_locale));
  if (meta.related.includes(meta.id)) issues.push('la ficha se enlaza a sí misma');
  return issues;
}

/** Que el cuerpo de una ficha (o de su versión en un idioma) tenga sus secciones, en orden. */
export function checkFichaBody(body: string, locale: Locale): string[] {
  const issues: string[] = [];
  const sections = GRAMMAR_SECTIONS_BY_LOCALE[locale];
  const headings = [...body.matchAll(/^## (.+)$/gm)].map((m) => (m[1] ?? '').trim());
  const missing = sections.filter((section) => !headings.includes(section));
  if (missing.length > 0) issues.push(`faltan secciones (${locale}): ${missing.join(', ')}`);
  const order = sections.map((section) => headings.indexOf(section)).filter((i) => i >= 0);
  if (order.some((position, i) => i > 0 && position < (order[i - 1] ?? 0))) {
    issues.push(`las secciones (${locale}) no están en el orden acordado`);
  }
  return issues;
}
