import { matchesAny, normalizeAnswer } from '@/features/tasks/lib/grade';
import { countExamWords, type UoeSet } from '@/lib/content/uoe-schema';

// Corrección de los ejercicios de Use of English, con los criterios del examen: un punto por
// hueco y, en las transformaciones, dos puntos por frase (uno por cada mitad). Lógica pura.

export type UoeNote =
  /** La respuesta se sale del límite de palabras: en el examen vale 0. */
  | 'word_limit'
  /** Falta la palabra dada o se ha cambiado: en el examen vale 0. */
  | 'keyword';

export interface UoeItemResult {
  n: number;
  marks: number;
  max: number;
  correct: boolean;
  /** Lo que se respondió, tal cual (en la parte 1, el texto de la opción elegida). */
  given: string;
  /** La respuesta modelo que se enseña al corregir. */
  answer: string;
  explanation_es: string;
  note?: UoeNote;
}

export interface UoeResult {
  items: UoeItemResult[];
  marks: number;
  total: number;
  /** De 0 a 1. */
  score: number;
}

/** Respuestas por número de hueco o de frase: texto, o el índice de la opción en la parte 1. */
export type UoeAnswers = Readonly<Record<number, string | number | undefined>>;

const IRREGULAR_CONTRACTIONS: Record<string, string> = {
  "can't": 'cannot',
  "won't": 'will not',
  "shan't": 'shall not',
};

/**
 * Formas completas posibles de una respuesta con contracciones: `I'd` puede ser `I had` o
 * `I would`, y `'s`, `is` o `has`. Así `wish I'd studied` vale igual que `wish I had studied`.
 */
export function expandContractions(text: string): string[] {
  let variants = [''];
  for (const word of normalizeAnswer(text).split(' ').filter(Boolean)) {
    let options: string[];
    if (IRREGULAR_CONTRACTIONS[word]) options = [IRREGULAR_CONTRACTIONS[word]];
    else if (word.endsWith("n't")) options = [`${word.slice(0, -3)} not`];
    else if (word.endsWith("'ve")) options = [`${word.slice(0, -3)} have`];
    else if (word.endsWith("'ll")) options = [`${word.slice(0, -3)} will`];
    else if (word.endsWith("'re")) options = [`${word.slice(0, -3)} are`];
    else if (word.endsWith("'m")) options = [`${word.slice(0, -2)} am`];
    else if (word.endsWith("'d")) {
      options = [`${word.slice(0, -2)} had`, `${word.slice(0, -2)} would`];
    } else if (word.endsWith("'s")) {
      // También puede ser un posesivo: se conserva tal cual como tercera lectura.
      options = [`${word.slice(0, -2)} is`, `${word.slice(0, -2)} has`, word];
    } else options = [word === 'can not' ? 'cannot' : word];
    variants = variants.flatMap((prefix) =>
      options.map((option) => (prefix === '' ? option : `${prefix} ${option}`)),
    );
    if (variants.length > 64) variants = variants.slice(0, 64);
  }
  return variants;
}

function gradeTransformation(
  given: string,
  item: { keyword: string; parts: readonly [readonly string[], readonly string[]] },
  limits: { min: number; max: number },
): { marks: number; note?: UoeNote } {
  const answer = normalizeAnswer(given);
  if (answer === '') return { marks: 0 };

  const words = countExamWords(answer);
  if (words < limits.min || words > limits.max) return { marks: 0, note: 'word_limit' };
  if (!answer.split(' ').includes(item.keyword.toLowerCase())) return { marks: 0, note: 'keyword' };

  // Se comparan las formas completas: con o sin contracción es la misma respuesta.
  const answers = expandContractions(answer);
  const firsts = item.parts[0].flatMap(expandContractions);
  const seconds = item.parts[1].flatMap(expandContractions);
  const is = (test: (candidate: string) => boolean) => answers.some(test);

  if (firsts.some((first) => seconds.some((second) => is((a) => a === `${first} ${second}`)))) {
    return { marks: 2 };
  }
  // Media respuesta: la primera mitad al principio o la segunda al final.
  const firstOk = firsts.some((first) => is((a) => a === first || a.startsWith(`${first} `)));
  const secondOk = seconds.some((second) => is((a) => a === second || a.endsWith(` ${second}`)));
  return { marks: firstOk || secondOk ? 1 : 0 };
}

export function gradeUoe(set: UoeSet, answers: UoeAnswers): UoeResult {
  let items: UoeItemResult[];

  if (set.part === 'key_word_transformation') {
    items = set.items.map((item) => {
      const given = String(answers[item.n] ?? '').trim();
      const { marks, note } = gradeTransformation(given, item, {
        min: set.min_words,
        max: set.max_words,
      });
      return {
        n: item.n,
        marks,
        max: 2,
        correct: marks === 2,
        given,
        answer: `${item.parts[0][0]} ${item.parts[1][0]}`,
        explanation_es: item.explanation_es,
        ...(note ? { note } : {}),
      };
    });
  } else if (set.part === 'mcq_cloze') {
    items = set.gaps.map((gap) => {
      const chosen = answers[gap.n];
      const index = typeof chosen === 'number' ? chosen : -1;
      const correct = index === gap.answer;
      return {
        n: gap.n,
        marks: correct ? 1 : 0,
        max: 1,
        correct,
        given: gap.options[index] ?? '',
        answer: gap.options[gap.answer] ?? '',
        explanation_es: gap.explanation_es,
      };
    });
  } else {
    items = set.gaps.map((gap) => {
      const given = String(answers[gap.n] ?? '').trim();
      const correct = matchesAny(given, gap.accept);
      return {
        n: gap.n,
        marks: correct ? 1 : 0,
        max: 1,
        correct,
        given,
        answer: gap.accept[0] ?? '',
        explanation_es: gap.explanation_es,
      };
    });
  }

  const marks = items.reduce((sum, item) => sum + item.marks, 0);
  const total = items.reduce((sum, item) => sum + item.max, 0);
  return { items, marks, total, score: total === 0 ? 0 : marks / total };
}

/** Parte un texto con huecos en trozos de texto y números de hueco, en orden. */
export function splitCloze(text: string): (string | number)[] {
  return text
    .split(/(\{\{\d+\}\})/)
    .filter((piece) => piece !== '')
    .map((piece) => {
      const gap = /^\{\{(\d+)\}\}$/.exec(piece);
      return gap ? Number(gap[1]) : piece;
    });
}

/**
 * La frase del texto donde está un hueco, con ese hueco como `___` y los demás rellenos:
 * es lo que se enseña en la tarjeta de repaso.
 */
export function sentenceWithGap(text: string, n: number, fill: (other: number) => string): string {
  const sentences = text.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [text];
  const own = sentences.find((sentence) => sentence.includes(`{{${n}}}`)) ?? text;
  return own
    .replace(/\{\{(\d+)\}\}/g, (_, digits: string) =>
      Number(digits) === n ? '___' : fill(Number(digits)),
    )
    .replace(/\s+/g, ' ')
    .trim();
}
