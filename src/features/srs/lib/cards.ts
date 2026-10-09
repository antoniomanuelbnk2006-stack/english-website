import { z } from 'zod';
import { sentenceWithGap } from '@/features/use-of-english/lib/grade';
import { lemmaKey, type DictionaryEntry } from '@/lib/content/dictionary-schema';
import type { Lesson } from '@/lib/content/schema';
import { fullAnswers, type UoeSet } from '@/lib/content/uoe-schema';

// Contenido de las tarjetas (docs/01-pedagogia/05-vocabulario-y-srs.md §7). Lógica pura.
// El servidor monta cada tarjeta a partir del contenido de la lección: del cliente solo llega
// qué palabra o qué frase se quiere repasar, nunca el texto de la tarjeta.

/** Tramo de un audio de lección: lo que suena en la tarjeta. */
export const Clip = z.object({
  /** Ruta del audio dentro del almacén (`audio/b1/b1-lis-001/v1.m4a`). */
  src: z.string().min(1),
  start: z.number().nonnegative(),
  end: z.number().positive(),
});
export type Clip = z.infer<typeof Clip>;

const Feature = z.object({
  phrase: z.string(),
  type: z.string(),
  ipa: z.string().optional(),
  explanation_es: z.string(),
});

/** Palabra o expresión dentro de la frase donde se encontró. */
const WordContent = z.object({
  front: z.object({
    sentence: z.string().min(1),
    /** Tal como aparece en la frase, para resaltarla. */
    surface: z.string().min(1),
    clip: Clip.optional(),
  }),
  back: z.object({
    pos: z.string(),
    /** Las tarjetas del mazo de palabras solo llevan la traducción. */
    def_en: z.string().min(1).optional(),
    def_es: z.string().min(1),
    example: z.string().optional(),
    note_es: z.string().optional(),
  }),
});

export const CardContent = z.discriminatedUnion('kind', [
  WordContent.extend({ kind: z.literal('word') }),
  WordContent.extend({ kind: z.literal('chunk') }),
  z.object({
    kind: z.literal('audio'),
    front: z.object({ clip: Clip }),
    back: z.object({
      text: z.string().min(1),
      /** Otras formas de escribir lo mismo que también valen en el dictado. */
      variants: z.array(z.string()).default([]),
      features: z.array(Feature).default([]),
    }),
  }),
  z.object({
    kind: z.literal('grammar'),
    front: z.object({
      /** Frase con el hueco marcado con `___`. */
      prompt: z.string().min(1),
      /** Frase de partida (transformaciones de Use of English). */
      context: z.string().optional(),
      /** Pista: la palabra dada, la raíz o las opciones. */
      hint: z.string().optional(),
    }),
    back: z.object({
      answers: z.array(z.string().min(1)).min(1),
      rule_es: z.string().min(1),
      title: z.string().min(1),
      /** De dónde sale: una ficha de gramática, un ejercicio de Use of English o un writing. */
      grammar_id: z.string().min(1).optional(),
      uoe_id: z.string().min(1).optional(),
      /** Id de la entrega (`writing_submissions.id`) de la que sale el error. */
      writing_id: z.string().min(1).optional(),
    }),
  }),
]);
export type CardContent = z.infer<typeof CardContent>;
export type CardKind = CardContent['kind'];

/** Lo que hace falta para insertar una tarjeta en `srs_cards`. */
export type NewCard = CardContent & {
  lemma: string | null;
  source_lesson_id: string | null;
  /**
   * Clave del origen dentro de su tipo. Va cualificada (`b1-lis-001:s16`) porque la unicidad
   * de `srs_cards` no incluye la lección y los ids de segmento se repiten entre lecciones.
   */
  source_segment_id: string;
};

const CHUNK_POS = new Set(['phrasal_verb', 'phrase']);

/** Una expresión de varias palabras es una unidad propia (`chunk`), no una palabra. */
export function kindOfEntry(entry: { lemma: string; pos: string }): 'word' | 'chunk' {
  return CHUNK_POS.has(entry.pos) || /\s/.test(entry.lemma.trim()) ? 'chunk' : 'word';
}

/** Frase (y tramo de audio, si lo hay) a la que apunta una referencia de la lección. */
export function sentenceAt(lesson: Lesson, ref: string): { text: string; clip?: Clip } | null {
  if (lesson.skill === 'listening') {
    const segment = lesson.segments.find((s) => s.id === ref);
    if (!segment) return null;
    return {
      text: segment.text,
      clip: { src: lesson.audio.src, start: segment.start, end: segment.end },
    };
  }
  for (const paragraph of lesson.paragraphs) {
    const sentence = paragraph.sentences.find((s) => s.id === ref);
    if (!sentence) continue;
    const timed = lesson.audio && sentence.start !== undefined && sentence.end !== undefined;
    return {
      text: sentence.text,
      ...(timed && lesson.audio
        ? { clip: { src: lesson.audio.src, start: sentence.start ?? 0, end: sentence.end ?? 0 } }
        : {}),
    };
  }
  return null;
}

/** Tarjeta de palabra o expresión a partir de una entrada del glosario de la lección. */
export function buildWordCard(lesson: Lesson, lemma: string): NewCard | null {
  const entry = lesson.glossary.find((g) => g.lemma === lemma);
  if (!entry) return null;
  const sentence = sentenceAt(lesson, entry.ref);
  if (!sentence) return null;
  return {
    kind: kindOfEntry(entry),
    lemma: entry.lemma,
    source_lesson_id: lesson.id,
    source_segment_id: `${lesson.id}:${entry.ref}`,
    front: {
      sentence: sentence.text,
      surface: entry.surface,
      ...(sentence.clip ? { clip: sentence.clip } : {}),
    },
    back: {
      pos: entry.pos,
      def_en: entry.def_en,
      def_es: entry.def_es,
      ...(entry.example ? { example: entry.example } : {}),
      ...(entry.note_es ? { note_es: entry.note_es } : {}),
    },
  };
}

/** Tarjeta de audio: el fragmento exacto de un segmento, con su texto y sus rasgos detrás. */
export function buildAudioCard(lesson: Lesson, segmentId: string): NewCard | null {
  if (lesson.skill !== 'listening') return null;
  const segment = lesson.segments.find((s) => s.id === segmentId);
  if (!segment) return null;
  const dictation = lesson.tasks.find(
    (task) => task.type === 'dictation' && task.segment === segmentId,
  );
  return {
    kind: 'audio',
    lemma: null,
    source_lesson_id: lesson.id,
    source_segment_id: `${lesson.id}:${segment.id}`,
    front: { clip: { src: lesson.audio.src, start: segment.start, end: segment.end } },
    back: {
      text: segment.text,
      variants: dictation?.type === 'dictation' ? dictation.accept_variants : [],
      features: lesson.connected_speech
        .filter((feature) => feature.ref === segment.id)
        .map(({ phrase, type, ipa, explanation_es }) => ({
          phrase,
          type,
          ...(ipa ? { ipa } : {}),
          explanation_es,
        })),
    },
  };
}

/**
 * Tarjeta de una palabra del mazo por nivel: delante, su frase de ejemplo con la palabra
 * resaltada; detrás, la traducción.
 */
export function buildDictionaryCard(entry: DictionaryEntry): NewCard {
  const key = lemmaKey(entry.lemma);
  return {
    kind: kindOfEntry({ lemma: entry.lemma, pos: entry.pos[0] ?? '' }),
    lemma: key,
    source_lesson_id: null,
    source_segment_id: `dict:${key}`,
    front: { sentence: entry.example, surface: entry.surface },
    back: { pos: entry.pos.join(', '), def_es: entry.es },
  };
}

export interface GrammarPracticeItem {
  id: string;
  prompt: string;
  answers: readonly string[];
  rule_es: string;
}

/** Tarjeta de gramática a partir de un ítem de la mini-práctica de una ficha. */
export function buildGrammarCard(
  ficha: { id: string; title: string },
  item: GrammarPracticeItem,
): NewCard {
  return {
    kind: 'grammar',
    lemma: null,
    source_lesson_id: null,
    source_segment_id: `${ficha.id}:${item.id}`,
    front: { prompt: item.prompt },
    back: {
      answers: [...item.answers],
      rule_es: item.rule_es,
      grammar_id: ficha.id,
      title: ficha.title,
    },
  };
}

/**
 * Tarjeta de repaso a partir de un hueco o una frase de un ejercicio de Use of English.
 * En los textos, la tarjeta lleva solo la frase del hueco, con los demás ya rellenos.
 */
export function buildUoeCard(set: UoeSet, n: number): NewCard | null {
  const base = {
    kind: 'grammar' as const,
    lemma: null,
    source_lesson_id: null,
    source_segment_id: `${set.id}:${n}`,
  };

  if (set.part === 'key_word_transformation') {
    const item = set.items.find((candidate) => candidate.n === n);
    if (!item) return null;
    return {
      ...base,
      front: {
        prompt: `${item.before} ___ ${item.after}`.trim(),
        context: item.original,
        hint: item.keyword,
      },
      back: {
        answers: fullAnswers(item),
        rule_es: item.explanation_es,
        title: set.title,
        uoe_id: set.id,
      },
    };
  }

  if (!set.gaps.some((candidate) => candidate.n === n)) return null;
  // Los demás huecos de la frase se rellenan con su respuesta modelo.
  const model = (other: number): string => {
    if (set.part === 'mcq_cloze') {
      const found = set.gaps.find((g) => g.n === other);
      return found?.options[found.answer] ?? '…';
    }
    return set.gaps.find((g) => g.n === other)?.accept[0] ?? '…';
  };
  const prompt = sentenceWithGap(set.text, n, model);

  const back = (answers: string[], rule: string) => ({
    answers,
    rule_es: rule,
    title: set.title,
    uoe_id: set.id,
  });

  if (set.part === 'mcq_cloze') {
    const found = set.gaps.find((g) => g.n === n);
    if (!found) return null;
    return {
      ...base,
      front: { prompt, hint: found.options.join(' · ') },
      back: back([found.options[found.answer] ?? ''], found.explanation_es),
    };
  }
  if (set.part === 'word_formation') {
    const found = set.gaps.find((g) => g.n === n);
    if (!found) return null;
    return {
      ...base,
      front: { prompt, hint: found.stem },
      back: back([...found.accept], found.explanation_es),
    };
  }
  const found = set.gaps.find((g) => g.n === n);
  if (!found) return null;
  return { ...base, front: { prompt }, back: back([...found.accept], found.explanation_es) };
}

/** Parte una frase alrededor de la palabra de la tarjeta, para resaltarla. */
export function splitAround(
  sentence: string,
  surface: string,
): { before: string; match: string; after: string } | null {
  const index = sentence.toLowerCase().indexOf(surface.toLowerCase());
  if (index < 0) return null;
  return {
    before: sentence.slice(0, index),
    match: sentence.slice(index, index + surface.length),
    after: sentence.slice(index + surface.length),
  };
}
