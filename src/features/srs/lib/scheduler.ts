import {
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card,
  type Grade as FsrsGrade,
} from 'ts-fsrs';
import { z } from 'zod';

// Repetición espaciada con FSRS (docs/01-pedagogia/05-vocabulario-y-srs.md §6, ADR-0006).
// Envoltorio puro de ts-fsrs: el mismo código programa en el cliente (para enseñar los
// intervalos) y vuelve a calcular en el servidor, que es quien manda.

export const SRS_PARAMS = generatorParameters({
  request_retention: 0.9,
  maximum_interval: 365,
  enable_fuzz: true,
  enable_short_term: true,
  learning_steps: ['1m', '10m'],
  relearning_steps: ['10m'],
});

/** Tarjetas nuevas que se estrenan al día. */
export const NEW_PER_DAY = 10;
/** Tiempo de repaso al día a partir del cual se avisa: el repaso no debe comerse el input. */
export const REVIEW_BUDGET_MS = 15 * 60_000;
/** Máximo de tarjetas vencidas que se traen de una vez. */
export const MAX_DUE = 200;
/** Una tarjeta se da por aprendida cuando su intervalo llega a tres semanas. */
export const MATURE_DAYS = 21;

/** 1 Otra vez · 2 Difícil · 3 Bien · 4 Fácil. */
export const Grade = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);
export type Grade = z.infer<typeof Grade>;
export const GRADES: readonly Grade[] = [1, 2, 3, 4];

/** 0 Nueva · 1 Aprendiendo · 2 Repaso · 3 Reaprendiendo. */
export type CardStateCode = 0 | 1 | 2 | 3;

/** Estado FSRS de una tarjeta tal como se guarda en `srs_cards` (fechas en ISO). */
export interface CardState {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: CardStateCode;
  last_review: string | null;
}

/** Fila de `srs_reviews` que deja un repaso: el estado de la tarjeta *antes* de responder. */
export interface ReviewLog {
  rating: Grade;
  state: CardStateCode;
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  last_elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  review: string;
}

const scheduler = fsrs(SRS_PARAMS);

const GRADE_TO_RATING: Record<Grade, FsrsGrade> = {
  1: Rating.Again,
  2: Rating.Hard,
  3: Rating.Good,
  4: Rating.Easy,
};

function toCard(state: CardState): Card {
  return {
    due: new Date(state.due),
    stability: state.stability,
    difficulty: state.difficulty,
    elapsed_days: state.elapsed_days,
    scheduled_days: state.scheduled_days,
    learning_steps: state.learning_steps,
    reps: state.reps,
    lapses: state.lapses,
    state: state.state as State,
    ...(state.last_review ? { last_review: new Date(state.last_review) } : {}),
  };
}

function fromCard(card: Card): CardState {
  return {
    due: card.due.toISOString(),
    // La base de datos guarda estos dos como `real` (32 bits): se redondean igual aquí para
    // que el cliente y el servidor partan siempre del mismo número.
    stability: Math.fround(card.stability),
    difficulty: Math.fround(card.difficulty),
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as CardStateCode,
    last_review: card.last_review ? card.last_review.toISOString() : null,
  };
}

/** Estado de una tarjeta recién creada: vence ya y no tiene historia. */
export function newCardState(now: Date): CardState {
  return {
    due: now.toISOString(),
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    learning_steps: 0,
    reps: 0,
    lapses: 0,
    state: 0,
    last_review: null,
  };
}

/** Aplica una valoración: devuelve el estado nuevo de la tarjeta y la fila del registro. */
export function review(
  state: CardState,
  grade: Grade,
  now: Date,
): { state: CardState; log: ReviewLog } {
  const { card, log } = scheduler.next(toCard(state), now, GRADE_TO_RATING[grade]);
  return {
    state: fromCard(card),
    log: {
      rating: grade,
      state: log.state as CardStateCode,
      due: log.due.toISOString(),
      stability: log.stability,
      difficulty: log.difficulty,
      elapsed_days: log.elapsed_days,
      last_elapsed_days: log.last_elapsed_days,
      scheduled_days: log.scheduled_days,
      learning_steps: log.learning_steps,
      review: log.review.toISOString(),
    },
  };
}

/** Cuándo volvería a salir la tarjeta con cada valoración (lo que enseñan los cuatro botones). */
export function previewIntervals(state: CardState, now: Date): Record<Grade, number> {
  const ms = (grade: Grade) =>
    new Date(review(state, grade, now).state.due).getTime() - now.getTime();
  return { 1: ms(1), 2: ms(2), 3: ms(3), 4: ms(4) };
}

export type IntervalUnit = 'minutes' | 'hours' | 'days' | 'months';

/** Un intervalo en la unidad en que se lee mejor: «10 min», «3 d», «2 meses». */
export function describeInterval(ms: number): { n: number; unit: IntervalUnit } {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return { n: minutes, unit: 'minutes' };
  const hours = Math.round(minutes / 60);
  if (hours < 24) return { n: hours, unit: 'hours' };
  const days = Math.round(hours / 24);
  if (days < 60) return { n: days, unit: 'days' };
  return { n: Math.round(days / 30), unit: 'months' };
}

/** ¿Está ya en repasos largos? Entonces la palabra pasa a «conocida» en el léxico. */
export function isMature(state: CardState): boolean {
  return state.state === 2 && state.scheduled_days >= MATURE_DAYS;
}

/**
 * Valoración sugerida para una tarjeta de audio según el dictado
 * (docs/01-pedagogia/05-vocabulario-y-srs.md §7). Siempre se puede cambiar antes de seguir.
 */
export function suggestAudioGrade({
  accuracy,
  elapsedMs,
  clipMs,
}: {
  /** Precisión del dictado, de 0 a 1. */
  accuracy: number;
  /** Lo que se tardó en responder. */
  elapsedMs: number;
  /** Duración del fragmento. */
  clipMs: number;
}): Grade {
  if (accuracy >= 1 && elapsedMs < clipMs * 1.5) return 4;
  if (accuracy >= 0.95) return 3;
  if (accuracy >= 0.8) return 2;
  return 1;
}

/** Las tarjetas de gramática se corrigen solas: acertada → Bien; fallada → Otra vez. */
export function gradeForGrammar(correct: boolean): Grade {
  return correct ? 3 : 1;
}

export interface QueueCard {
  id: string;
  state: CardStateCode;
  due: string;
  created_at: string;
}

/**
 * Cola de una sesión: primero lo que se está aprendiendo (va por minutos), luego los repasos
 * vencidos por antigüedad, con las tarjetas nuevas que queden hoy repartidas entre ellos para
 * que no lleguen todas juntas al final.
 */
export function buildQueue<T extends QueueCard>(
  cards: readonly T[],
  {
    now,
    newDoneToday,
    newPerDay = NEW_PER_DAY,
  }: { now: Date; newDoneToday: number; newPerDay?: number },
): T[] {
  const time = now.getTime();
  const byDue = (a: T, b: T) => a.due.localeCompare(b.due) || a.id.localeCompare(b.id);
  const isDue = (card: T) => new Date(card.due).getTime() <= time;

  const learning = cards.filter((c) => (c.state === 1 || c.state === 3) && isDue(c)).sort(byDue);
  const reviews = cards.filter((c) => c.state === 2 && isDue(c)).sort(byDue);
  const fresh = cards
    .filter((c) => c.state === 0)
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
    .slice(0, Math.max(0, newPerDay - newDoneToday));

  const mixed: T[] = [];
  const every = fresh.length === 0 ? 0 : Math.max(1, Math.floor(reviews.length / fresh.length));
  let next = 0;
  reviews.forEach((card, index) => {
    mixed.push(card);
    const one = fresh[next];
    if (every > 0 && (index + 1) % every === 0 && one) {
      mixed.push(one);
      next++;
    }
  });
  return [...learning, ...mixed, ...fresh.slice(next)];
}
