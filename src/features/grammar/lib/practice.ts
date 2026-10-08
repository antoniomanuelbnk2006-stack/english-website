import { matchesAny } from '@/features/tasks/lib/grade';

// Mini-práctica de las fichas de gramática (docs/01-pedagogia/06-gramatica.md). Lógica pura.

/** Nota a partir de la cual una ficha se da por dominada (4 de 5). */
export const MASTERED_SCORE = 0.8;

export type FichaState = 'new' | 'seen' | 'practiced' | 'mastered';

/** Estado de una ficha a partir de su progreso guardado. */
export function fichaState(
  progress: { status: 'started' | 'completed'; bestScore: number | null } | null | undefined,
): FichaState {
  if (!progress) return 'new';
  if (progress.status !== 'completed') return 'seen';
  return (progress.bestScore ?? 0) >= MASTERED_SCORE ? 'mastered' : 'practiced';
}

export interface PracticeKey {
  id: string;
  answers: readonly string[];
  rule_es: string;
}

export interface PracticeItemResult {
  itemId: string;
  correct: boolean;
  /** La respuesta que se enseña al corregir. */
  answer: string;
  rule_es: string;
}

/**
 * Corrige la mini-práctica. Un ítem sin respuesta cuenta como fallado; las respuestas a ítems
 * que no existen se ignoran.
 */
export function gradePractice(
  items: readonly PracticeKey[],
  answers: ReadonlyMap<string, string>,
): { results: PracticeItemResult[]; score: number } {
  const results = items.map((item) => ({
    itemId: item.id,
    correct: matchesAny(answers.get(item.id) ?? '', item.answers),
    answer: item.answers[0] ?? '',
    rule_es: item.rule_es,
  }));
  const hits = results.filter((result) => result.correct).length;
  return { results, score: items.length === 0 ? 0 : hits / items.length };
}

/** Parte un enunciado por su hueco (`___`) para poner ahí el campo de texto. */
export function splitPrompt(prompt: string): { before: string; after: string } {
  const index = prompt.indexOf('___');
  if (index < 0) return { before: prompt, after: '' };
  return { before: prompt.slice(0, index), after: prompt.slice(index + 3) };
}
