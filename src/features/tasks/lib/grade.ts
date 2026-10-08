import { z } from 'zod';
import { diagnoseBest } from '@/features/listening/lib/dictation';
import type { Task } from '@/lib/content/schema';

/** La precisión de un dictado no depende del léxico del usuario (eso solo afecta a la causa). */
const NO_LEMMAS: ReadonlySet<string> = new Set();

// Corrección de tareas: lógica pura, compartida por el cliente (respuesta inmediata)
// y el servidor (que vuelve a corregir y no se fía de la nota del cliente).

/** Respuesta del usuario a una tarea, según su tipo. */
export const TaskResponse = z.discriminatedUnion('type', [
  z.object({ type: z.literal('mcq'), answer: z.string().max(4) }),
  z.object({ type: z.literal('multi_select'), answers: z.array(z.string().max(4)).max(12) }),
  z.object({ type: z.literal('true_false_ng'), answer: z.enum(['T', 'F', 'NG']) }),
  z.object({ type: z.literal('gap_fill'), gaps: z.record(z.string(), z.string().max(200)) }),
  z.object({ type: z.literal('matching'), pairs: z.record(z.string(), z.string().max(4)) }),
  z.object({ type: z.literal('ordering'), order: z.array(z.string().max(4)).max(20) }),
  z.object({ type: z.literal('short_answer'), text: z.string().max(200) }),
  z.object({ type: z.literal('heading_match'), answers: z.record(z.string(), z.string().max(4)) }),
  z.object({ type: z.literal('dictation'), text: z.string().max(600) }),
]);
export type TaskResponse = z.infer<typeof TaskResponse>;

export interface GradeResult {
  /** De 0 a 1; parcial en tareas con varias partes. */
  score: number;
  correct: boolean;
  /** Acierto por parte (hueco, pareja, posición…), para pintar la corrección. */
  parts: Record<string, boolean>;
}

/**
 * Normaliza un texto corto para compararlo: sin mayúsculas, espacios de más ni puntuación
 * en los extremos, y con apóstrofos rectos.
 */
export function normalizeAnswer(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[“”]/g, '"')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[\s.,;:!?"'()«»-]+|[\s.,;:!?"'()«»-]+$/g, '');
}

export function matchesAny(answer: string, accepted: readonly string[]): boolean {
  const normalized = normalizeAnswer(answer);
  return normalized !== '' && accepted.some((option) => normalizeAnswer(option) === normalized);
}

const wordCount = (text: string) => normalizeAnswer(text).split(' ').filter(Boolean).length;

function fromParts(parts: Record<string, boolean>): GradeResult {
  const values = Object.values(parts);
  const hits = values.filter(Boolean).length;
  const score = values.length === 0 ? 0 : hits / values.length;
  return { score, correct: score === 1, parts };
}

const single = (correct: boolean): GradeResult => ({
  score: correct ? 1 : 0,
  correct,
  parts: { answer: correct },
});

/**
 * Corrige una respuesta. Si la respuesta es de otro tipo de tarea, la nota es 0.
 */
export function grade(task: Task, response: TaskResponse): GradeResult {
  if (task.type !== response.type) return single(false);

  switch (task.type) {
    case 'mcq':
      return single(response.type === 'mcq' && response.answer === task.answer);

    case 'true_false_ng':
      return single(response.type === 'true_false_ng' && response.answer === task.answer);

    case 'short_answer': {
      if (response.type !== 'short_answer') return single(false);
      const withinLimit = wordCount(response.text) <= task.max_words;
      return single(withinLimit && matchesAny(response.text, task.accept));
    }

    case 'gap_fill': {
      if (response.type !== 'gap_fill') return single(false);
      const parts: Record<string, boolean> = {};
      for (const gap of task.gaps) {
        const answer = response.gaps[String(gap.n)] ?? '';
        parts[String(gap.n)] = wordCount(answer) <= gap.max_words && matchesAny(answer, gap.accept);
      }
      return fromParts(parts);
    }

    case 'matching': {
      if (response.type !== 'matching') return single(false);
      const parts: Record<string, boolean> = {};
      for (const [left, right] of Object.entries(task.pairs)) {
        parts[left] = response.pairs[left] === right;
      }
      return fromParts(parts);
    }

    case 'heading_match': {
      if (response.type !== 'heading_match') return single(false);
      const parts: Record<string, boolean> = {};
      for (const paragraph of task.paragraphs) {
        parts[paragraph] = response.answers[paragraph] === task.answers[paragraph];
      }
      return fromParts(parts);
    }

    case 'ordering': {
      if (response.type !== 'ordering') return single(false);
      const parts: Record<string, boolean> = {};
      task.correct_order.forEach((id, index) => {
        parts[id] = response.order[index] === id;
      });
      return fromParts(parts);
    }

    case 'multi_select': {
      if (response.type !== 'multi_select') return single(false);
      const expected = new Set(task.answers);
      const chosen = new Set(response.answers);
      const parts: Record<string, boolean> = {};
      for (const option of task.options) {
        parts[option.id] = expected.has(option.id) === chosen.has(option.id);
      }
      // Marcar de más resta: acertar todas marcándolo todo no puede dar la nota máxima.
      const hits = [...chosen].filter((id) => expected.has(id)).length;
      const extras = chosen.size - hits;
      const score = Math.max(0, (hits - extras) / expected.size);
      return { score, correct: score === 1, parts };
    }

    case 'dictation': {
      // La nota es la precisión del dictado: palabras correctas / palabras de la referencia.
      if (response.type !== 'dictation') return single(false);
      const { accuracy } = diagnoseBest(
        { reference: task.reference, typed: response.text, knownLemmas: NO_LEMMAS },
        task.accept_variants,
      );
      return { score: accuracy, correct: accuracy === 1, parts: { answer: accuracy === 1 } };
    }
  }
}

/** ¿Está la respuesta lo bastante completa como para poder comprobarla? */
export function isAnswered(task: Task, response: TaskResponse | undefined): boolean {
  if (!response || response.type !== task.type) return false;
  switch (response.type) {
    case 'mcq':
    case 'true_false_ng':
      return response.answer !== '';
    case 'short_answer':
    case 'dictation':
      return response.text.trim() !== '';
    case 'multi_select':
      return response.answers.length > 0;
    case 'gap_fill':
      return (
        task.type === 'gap_fill' &&
        task.gaps.every((g) => (response.gaps[String(g.n)] ?? '').trim() !== '')
      );
    case 'matching':
      return (
        task.type === 'matching' && task.left.every((item) => Boolean(response.pairs[item.id]))
      );
    case 'heading_match':
      return (
        task.type === 'heading_match' && task.paragraphs.every((p) => Boolean(response.answers[p]))
      );
    case 'ordering':
      return task.type === 'ordering' && response.order.length === task.items.length;
  }
}
