import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
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
  rule_es: z.string().min(1),
});
export type PracticeItem = z.infer<typeof PracticeItem>;

export const GrammarExample = z.object({
  en: z.string().min(1),
  es: z.string().min(1),
});

export const GrammarMeta = z.object({
  id: GrammarId,
  level: Cefr,
  title: z.string().min(1),
  summary_es: z.string().min(1),
  skills: z.array(z.enum(['listening', 'reading', 'writing', 'speaking'])).min(1),
  related: z.array(GrammarId).default([]),
  examples: z.array(GrammarExample).min(2),
  practice: z.array(PracticeItem).length(5),
});
export type GrammarMeta = z.infer<typeof GrammarMeta>;

/** Secciones que toda ficha lleva en el cuerpo, en este orden. */
export const GRAMMAR_SECTIONS = [
  'En una frase',
  'Forma',
  'Uso',
  'Contraste con el español',
  'Errores típicos',
  'Cómo suena',
] as const;

export interface ParsedFicha {
  meta: GrammarMeta;
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
  if (!meta.id.startsWith(`${meta.level.toLowerCase()}.`)) {
    issues.push(`el id debe empezar por «${meta.level.toLowerCase()}.»`);
  }

  const ids = meta.practice.map((item) => item.id);
  if (new Set(ids).size !== ids.length) issues.push('hay ítems de práctica con el mismo id');
  for (const item of meta.practice) {
    if ((item.prompt.match(/___/g) ?? []).length !== 1) {
      issues.push(`${item.id}: cada ítem lleva un solo hueco`);
    }
  }

  const headings = [...body.matchAll(/^## (.+)$/gm)].map((m) => (m[1] ?? '').trim());
  const missing = GRAMMAR_SECTIONS.filter((section) => !headings.includes(section));
  if (missing.length > 0) issues.push(`faltan secciones: ${missing.join(', ')}`);
  const order = GRAMMAR_SECTIONS.map((section) => headings.indexOf(section)).filter((i) => i >= 0);
  if (order.some((position, i) => i > 0 && position < (order[i - 1] ?? 0))) {
    issues.push('las secciones no están en el orden acordado');
  }
  if (meta.related.includes(meta.id)) issues.push('la ficha se enlaza a sí misma');
  return issues;
}
