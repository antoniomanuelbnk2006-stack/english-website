import { z } from 'zod';
import { helpText, type Localized } from './help';
import { DASH_PREFIX, withoutLanguage } from './language';
import { Cefr } from './schema';

// Use of English: ejercicios con el formato de los exámenes de Cambridge, por nivel
// (docs/adr/0012-use-of-english.md). Viven en `content/use-of-english/{nivel}/{id}.json`.
// Textos originales: nada copiado de exámenes reales.

export const UoeId = z.string().regex(new RegExp(`^${DASH_PREFIX}(a1|a2|b1|b2|c1|c2)-uoe-\\d{3}$`));

export const UOE_PARTS = [
  'mcq_cloze',
  'open_cloze',
  'word_formation',
  'key_word_transformation',
] as const;
export type UoePart = (typeof UOE_PARTS)[number];

const Base = z.object({
  id: UoeId,
  version: z.number().int().positive(),
  status: z.enum(['draft', 'published']),
  level: Cefr,
  /** Título del texto (en inglés) o del ejercicio. */
  title: z.string().min(1),
  /** Una línea en español para la tarjeta del índice. */
  summary_es: helpText(),
  est_minutes: z.number().int().positive(),
  provenance: z.object({
    origin: z.enum(['human', 'ai']),
    model: z.string().optional(),
    created_at: z.string(),
    reviewed_by: z.string().optional(),
  }),
});

/** Texto con los huecos marcados `{{1}}`, `{{2}}`… */
const ClozeText = z.string().min(1);
const Explanation = helpText();

/** Parte 1 · Elegir la palabra que encaja (léxico, colocaciones, verbos frasales). */
export const McqCloze = Base.extend({
  part: z.literal('mcq_cloze'),
  text: ClozeText,
  gaps: z
    .array(
      z.object({
        n: z.number().int().positive(),
        options: z.array(z.string().min(1)).min(3).max(4),
        /** Índice de la opción correcta (0 = A). */
        answer: z.number().int().min(0).max(3),
        explanation_es: Explanation,
      }),
    )
    .min(4)
    .max(10),
});

/** Parte 2 · Una palabra por hueco, sin opciones (gramática y palabras de enlace). */
export const OpenCloze = Base.extend({
  part: z.literal('open_cloze'),
  text: ClozeText,
  gaps: z
    .array(
      z.object({
        n: z.number().int().positive(),
        accept: z.array(z.string().min(1)).min(1),
        explanation_es: Explanation,
      }),
    )
    .min(4)
    .max(10),
});

/** Parte 3 · Formar la palabra que encaja a partir de la raíz dada. */
export const WordFormation = Base.extend({
  part: z.literal('word_formation'),
  text: ClozeText,
  gaps: z
    .array(
      z.object({
        n: z.number().int().positive(),
        /** La palabra dada, en mayúsculas. */
        stem: z.string().regex(/^[A-Z]+$/),
        accept: z.array(z.string().min(1)).min(1),
        explanation_es: Explanation,
      }),
    )
    .min(4)
    .max(10),
});

/**
 * Parte 4 · Reescribir la frase usando la palabra dada, sin cambiarla. Cada respuesta vale dos
 * puntos y se corrige en dos mitades (`parts`), como en el examen.
 */
export const KeyWordTransformation = Base.extend({
  part: z.literal('key_word_transformation'),
  /** Límite de palabras de la respuesta (B2: 2–5; C1: 3–6; C2: 3–8). */
  min_words: z.number().int().min(1),
  max_words: z.number().int().max(8),
  items: z
    .array(
      z.object({
        n: z.number().int().positive(),
        original: z.string().min(1),
        /** La palabra dada, en mayúsculas. */
        keyword: z.string().regex(/^[A-Z']+$/),
        /** Lo que va antes y después del hueco en la segunda frase. */
        before: z.string(),
        after: z.string(),
        /** Las dos mitades de la respuesta, cada una con sus variantes válidas. */
        parts: z.tuple([
          z.array(z.string().min(1)).min(1),
          z.array(z.string().min(1)).min(1),
        ]),
        explanation_es: Explanation,
      }),
    )
    .min(3)
    .max(8),
});

export const UoeSet = z.discriminatedUnion('part', [
  McqCloze,
  OpenCloze,
  WordFormation,
  KeyWordTransformation,
]);
export type RawUoeSet = z.infer<typeof UoeSet>;
export type UoeSet = Localized<RawUoeSet>;
export type RawKwtSet = z.infer<typeof KeyWordTransformation>;
export type KwtSet = Localized<RawKwtSet>;

const normalize = (text: string) =>
  text
    .normalize('NFKC')
    .replace(/[‘’ʼ`´]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Palabras de una respuesta tal como las cuenta el examen: una contracción vale por dos
 * (salvo `can't`, que es `cannot`).
 */
export function countExamWords(answer: string): number {
  return normalize(answer)
    .split(' ')
    .filter(Boolean)
    .reduce((sum, word) => sum + (word.includes("'") && word !== "can't" ? 2 : 1), 0);
}

/** Todas las respuestas completas válidas de una transformación (cada mitad con cada mitad). */
export function fullAnswers(item: { parts: readonly [readonly string[], readonly string[]] }) {
  return item.parts[0].flatMap((first) => item.parts[1].map((second) => `${first} ${second}`));
}

/** Números de hueco que aparecen en un texto, en orden de aparición. */
export function gapNumbers(text: string): number[] {
  return [...text.matchAll(/\{\{(\d+)\}\}/g)].map((match) => Number(match[1]));
}

/** Comprobaciones que el esquema no puede expresar. Devuelve los problemas encontrados. */
export function checkUoeSet(set: RawUoeSet, expected: { id: string; level: string }): string[] {
  const issues: string[] = [];
  if (set.id !== expected.id) issues.push(`el id «${set.id}» no coincide con el fichero`);
  if (set.level.toLowerCase() !== expected.level) {
    issues.push(`el nivel ${set.level} no coincide con la carpeta ${expected.level}`);
  }
  if (!withoutLanguage(set.id).startsWith(`${set.level.toLowerCase()}-`)) {
    issues.push(`el id debe empezar por «${set.level.toLowerCase()}-»`);
  }

  if (set.part === 'key_word_transformation') {
    const numbers = set.items.map((item) => item.n);
    if (numbers.some((n, index) => n !== index + 1)) issues.push('los ítems se numeran 1, 2, 3…');
    for (const item of set.items) {
      const keyword = item.keyword.toLowerCase();
      for (const answer of fullAnswers(item)) {
        const words = normalize(answer).split(' ');
        if (!words.includes(keyword)) {
          issues.push(`ítem ${item.n}: «${answer}» no contiene la palabra dada ${item.keyword}`);
        }
        const count = countExamWords(answer);
        if (count < set.min_words || count > set.max_words) {
          issues.push(
            `ítem ${item.n}: «${answer}» tiene ${count} palabras (límite ${set.min_words}–${set.max_words})`,
          );
        }
      }
      if (item.parts.some((half) => half.some((text) => normalize(text) === keyword))) {
        issues.push(`ítem ${item.n}: una mitad es solo la palabra dada (ese punto se regalaría)`);
      }
      if (normalize(item.original).includes(` ${keyword} `)) {
        issues.push(`ítem ${item.n}: la frase original ya contiene la palabra dada`);
      }
    }
    return issues;
  }

  // Huecos del texto: cada uno una vez, numerados 1, 2, 3… en el orden en que aparecen.
  const inText = gapNumbers(set.text);
  const declared = set.gaps.map((gap) => gap.n);
  if (inText.join() !== declared.join()) {
    issues.push(`los huecos del texto (${inText.join(', ')}) no coinciden con «gaps» (${declared.join(', ')})`);
  }
  if (declared.some((n, index) => n !== index + 1)) issues.push('los huecos se numeran 1, 2, 3…');

  if (set.part === 'mcq_cloze') {
    for (const gap of set.gaps) {
      if (gap.answer >= gap.options.length) issues.push(`hueco ${gap.n}: la respuesta no existe`);
      const unique = new Set(gap.options.map(normalize));
      if (unique.size !== gap.options.length) issues.push(`hueco ${gap.n}: hay opciones repetidas`);
    }
  } else if (set.part === 'open_cloze') {
    for (const gap of set.gaps) {
      const long = gap.accept.filter((answer) => normalize(answer).includes(' '));
      if (long.length > 0) {
        issues.push(`hueco ${gap.n}: «${long.join('», «')}» no es una sola palabra`);
      }
    }
  } else {
    for (const gap of set.gaps) {
      if (gap.accept.some((answer) => normalize(answer) === gap.stem.toLowerCase())) {
        issues.push(`hueco ${gap.n}: la respuesta es la palabra dada sin cambiar`);
      }
    }
  }
  return issues;
}

// ───────────── Lo que ve el navegador antes de corregir ─────────────

export type PublicUoeSet =
  | {
      id: string;
      version: number;
      level: z.infer<typeof Cefr>;
      part: 'mcq_cloze';
      title: string;
      text: string;
      gaps: { n: number; options: string[] }[];
    }
  | {
      id: string;
      version: number;
      level: z.infer<typeof Cefr>;
      part: 'open_cloze';
      title: string;
      text: string;
      gaps: { n: number }[];
    }
  | {
      id: string;
      version: number;
      level: z.infer<typeof Cefr>;
      part: 'word_formation';
      title: string;
      text: string;
      gaps: { n: number; stem: string }[];
    }
  | {
      id: string;
      version: number;
      level: z.infer<typeof Cefr>;
      part: 'key_word_transformation';
      title: string;
      min_words: number;
      max_words: number;
      items: { n: number; original: string; keyword: string; before: string; after: string }[];
    };

/** El ejercicio sin respuestas ni explicaciones: eso se queda en el servidor hasta corregir. */
export function toPublicSet(set: UoeSet): PublicUoeSet {
  const base = { id: set.id, version: set.version, level: set.level, title: set.title };
  switch (set.part) {
    case 'mcq_cloze':
      return {
        ...base,
        part: set.part,
        text: set.text,
        gaps: set.gaps.map(({ n, options }) => ({ n, options })),
      };
    case 'open_cloze':
      return { ...base, part: set.part, text: set.text, gaps: set.gaps.map(({ n }) => ({ n })) };
    case 'word_formation':
      return {
        ...base,
        part: set.part,
        text: set.text,
        gaps: set.gaps.map(({ n, stem }) => ({ n, stem })),
      };
    case 'key_word_transformation':
      return {
        ...base,
        part: set.part,
        min_words: set.min_words,
        max_words: set.max_words,
        items: set.items.map(({ n, original, keyword, before, after }) => ({
          n,
          original,
          keyword,
          before,
          after,
        })),
      };
  }
}
