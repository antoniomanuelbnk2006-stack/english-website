import { describe, expect, it } from 'vitest';
import {
  buildQueue,
  describeInterval,
  gradeForGrammar,
  isMature,
  newCardState,
  NEW_PER_DAY,
  previewIntervals,
  review,
  suggestAudioGrade,
  type CardState,
  type Grade,
  type QueueCard,
} from './scheduler';

const T0 = new Date('2026-10-08T08:00:00Z');
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const at = (ms: number) => new Date(T0.getTime() + ms);
const dueIn = (state: CardState, now: Date) => new Date(state.due).getTime() - now.getTime();

/** Repasa una tarjeta cada vez que vence, siempre con la misma valoración. */
function repeat(grade: Grade, times: number) {
  let state = newCardState(T0);
  let now = T0;
  const intervals: number[] = [];
  for (let i = 0; i < times; i++) {
    state = review(state, grade, now).state;
    intervals.push(dueIn(state, now));
    now = new Date(state.due);
  }
  return { state, intervals };
}

describe('tarjeta nueva', () => {
  it('vence en el momento y no tiene historia', () => {
    expect(newCardState(T0)).toMatchObject({
      due: T0.toISOString(),
      state: 0,
      reps: 0,
      lapses: 0,
      last_review: null,
    });
  });

  it('pasos de aprendizaje: Otra vez → 1 min; Bien → 10 min', () => {
    const state = newCardState(T0);
    expect(dueIn(review(state, 1, T0).state, T0)).toBe(1 * MINUTE);
    expect(dueIn(review(state, 3, T0).state, T0)).toBe(10 * MINUTE);
    expect(review(state, 3, T0).state.state).toBe(1);
  });

  it('con Fácil se gradúa directamente a repaso, a días vista', () => {
    const next = review(newCardState(T0), 4, T0).state;
    expect(next.state).toBe(2);
    expect(dueIn(next, T0)).toBeGreaterThanOrEqual(DAY);
  });

  it('con dos «Bien» seguidos sale del aprendizaje', () => {
    const first = review(newCardState(T0), 3, T0).state;
    const second = review(first, 3, at(10 * MINUTE)).state;
    expect(second.state).toBe(2);
    expect(second.scheduled_days).toBeGreaterThanOrEqual(1);
  });
});

describe('repaso', () => {
  it('los intervalos crecen al acertar hasta el tope de un año', () => {
    const { intervals, state } = repeat(3, 14);
    const days = intervals.slice(1).map((ms) => Math.round(ms / DAY));
    // Cerca del tope el *fuzz* reparte los repasos unos días arriba o abajo (ts-fsrs puede
    // pasarse un día de `maximum_interval`).
    const growing = days.filter((d) => d < 300);
    expect(growing.length).toBeGreaterThan(3);
    for (let i = 1; i < growing.length; i++) {
      expect(growing[i]).toBeGreaterThan(growing[i - 1] ?? 0);
    }
    expect(Math.max(...days)).toBeGreaterThan(300);
    expect(Math.max(...days)).toBeLessThanOrEqual(366);
    expect(state.scheduled_days).toBeLessThanOrEqual(366);
  });

  it('a mejor valoración, intervalo más largo', () => {
    const { state } = repeat(3, 4);
    const now = new Date(state.due);
    const preview = previewIntervals(state, now);
    expect(preview[1]).toBeLessThan(preview[2]);
    expect(preview[2]).toBeLessThanOrEqual(preview[3]);
    expect(preview[3]).toBeLessThan(preview[4]);
  });

  it('fallar una tarjeta en repaso cuenta un olvido y la manda a reaprender en 10 min', () => {
    const { state } = repeat(3, 4);
    const now = new Date(state.due);
    const lapsed = review(state, 1, now).state;
    expect(lapsed.state).toBe(3);
    expect(lapsed.lapses).toBe(state.lapses + 1);
    expect(dueIn(lapsed, now)).toBe(10 * MINUTE);
  });

  it('es determinista: el servidor obtiene lo mismo que enseñó el cliente', () => {
    const { state } = repeat(3, 5);
    const now = new Date(state.due);
    expect(review(state, 3, now)).toEqual(review(state, 3, now));
    // Y sobrevive a un viaje por JSON (así llega de la base de datos).
    const stored = JSON.parse(JSON.stringify(state)) as CardState;
    expect(review(stored, 2, now)).toEqual(review(state, 2, now));
  });

  it('no modifica el estado que recibe', () => {
    const state = newCardState(T0);
    const copy = { ...state };
    review(state, 3, T0);
    expect(state).toEqual(copy);
  });

  it('el registro guarda el estado anterior, la valoración y el momento', () => {
    const { state } = repeat(3, 3);
    const now = new Date(state.due);
    const { log } = review(state, 2, now);
    expect(log).toMatchObject({
      rating: 2,
      state: state.state,
      stability: state.stability,
      difficulty: state.difficulty,
      review: now.toISOString(),
    });
  });
});

describe('tarjeta aprendida', () => {
  it('lo está a partir de tres semanas de intervalo en repaso', () => {
    const base = newCardState(T0);
    expect(isMature({ ...base, state: 2, scheduled_days: 21 })).toBe(true);
    expect(isMature({ ...base, state: 2, scheduled_days: 20 })).toBe(false);
    expect(isMature({ ...base, state: 3, scheduled_days: 40 })).toBe(false);
  });

  it('se llega con unos cuantos aciertos seguidos', () => {
    expect(isMature(repeat(3, 3).state)).toBe(false);
    expect(isMature(repeat(3, 8).state)).toBe(true);
  });
});

describe('describeInterval', () => {
  it('elige la unidad que mejor se lee', () => {
    expect(describeInterval(MINUTE)).toEqual({ n: 1, unit: 'minutes' });
    expect(describeInterval(10 * MINUTE)).toEqual({ n: 10, unit: 'minutes' });
    expect(describeInterval(3 * 60 * MINUTE)).toEqual({ n: 3, unit: 'hours' });
    expect(describeInterval(4 * DAY)).toEqual({ n: 4, unit: 'days' });
    expect(describeInterval(59 * DAY)).toEqual({ n: 59, unit: 'days' });
    expect(describeInterval(90 * DAY)).toEqual({ n: 3, unit: 'months' });
  });

  it('nunca dice «0 min»', () => {
    expect(describeInterval(5_000)).toEqual({ n: 1, unit: 'minutes' });
  });
});

describe('valoración sugerida', () => {
  it('audio: perfecto y rápido → Fácil', () => {
    expect(suggestAudioGrade({ accuracy: 1, elapsedMs: 4_000, clipMs: 3_000 })).toBe(4);
  });

  it('audio: perfecto pero lento → Bien', () => {
    expect(suggestAudioGrade({ accuracy: 1, elapsedMs: 4_500, clipMs: 3_000 })).toBe(3);
    expect(suggestAudioGrade({ accuracy: 1, elapsedMs: 20_000, clipMs: 3_000 })).toBe(3);
  });

  it('audio: ≥ 95 % → Bien; 80–94 % → Difícil; < 80 % → Otra vez', () => {
    const grade = (accuracy: number) =>
      suggestAudioGrade({ accuracy, elapsedMs: 0, clipMs: 3_000 });
    expect(grade(0.95)).toBe(3);
    expect(grade(0.949)).toBe(2);
    expect(grade(0.8)).toBe(2);
    expect(grade(0.799)).toBe(1);
    expect(grade(0)).toBe(1);
  });

  it('gramática: acertada → Bien; fallada → Otra vez', () => {
    expect(gradeForGrammar(true)).toBe(3);
    expect(gradeForGrammar(false)).toBe(1);
  });
});

describe('buildQueue', () => {
  const card = (
    id: string,
    state: QueueCard['state'],
    dueMs: number,
    createdMs = 0,
  ): QueueCard => ({
    id,
    state,
    due: at(dueMs).toISOString(),
    created_at: at(createdMs).toISOString(),
  });
  const ids = (cards: QueueCard[]) => cards.map((c) => c.id);

  it('primero lo que se está aprendiendo, después los repasos por antigüedad', () => {
    const queue = buildQueue(
      [card('r2', 2, -1 * DAY), card('l1', 1, -MINUTE), card('r1', 2, -3 * DAY), card('x', 3, -5)],
      { now: T0, newDoneToday: 0 },
    );
    expect(ids(queue)).toEqual(['l1', 'x', 'r1', 'r2']);
  });

  it('deja fuera lo que todavía no ha vencido', () => {
    const queue = buildQueue([card('a', 2, DAY), card('b', 1, 5 * MINUTE), card('c', 2, 0)], {
      now: T0,
      newDoneToday: 0,
    });
    expect(ids(queue)).toEqual(['c']);
  });

  it('respeta el tope de nuevas al día, descontando las ya estrenadas hoy', () => {
    const fresh = Array.from({ length: 25 }, (_, i) =>
      card(`n${String(i).padStart(2, '0')}`, 0, 0, i),
    );
    expect(buildQueue(fresh, { now: T0, newDoneToday: 0 })).toHaveLength(NEW_PER_DAY);
    expect(buildQueue(fresh, { now: T0, newDoneToday: 7 })).toHaveLength(3);
    expect(buildQueue(fresh, { now: T0, newDoneToday: 10 })).toHaveLength(0);
    expect(buildQueue(fresh, { now: T0, newDoneToday: 12 })).toHaveLength(0);
  });

  it('las nuevas salen por orden de creación', () => {
    const queue = buildQueue([card('b', 0, 0, 20), card('a', 0, 0, 10), card('c', 0, 0, 30)], {
      now: T0,
      newDoneToday: 0,
    });
    expect(ids(queue)).toEqual(['a', 'b', 'c']);
  });

  it('reparte las nuevas entre los repasos en vez de dejarlas para el final', () => {
    const reviews = Array.from({ length: 6 }, (_, i) => card(`r${i}`, 2, -(10 - i) * DAY));
    const fresh = [card('n0', 0, 0, 0), card('n1', 0, 0, 1)];
    const queue = buildQueue([...reviews, ...fresh], { now: T0, newDoneToday: 0 });
    expect(ids(queue)).toEqual(['r0', 'r1', 'r2', 'n0', 'r3', 'r4', 'r5', 'n1']);
  });

  it('con más nuevas que repasos, las que sobran van al final', () => {
    const queue = buildQueue(
      [card('r0', 2, -DAY), card('n0', 0, 0, 0), card('n1', 0, 0, 1), card('n2', 0, 0, 2)],
      { now: T0, newDoneToday: 0 },
    );
    expect(ids(queue)).toEqual(['r0', 'n0', 'n1', 'n2']);
  });

  it('una semana de uso: 10 nuevas al día no provocan una avalancha de repasos', () => {
    // 70 tarjetas creadas de golpe; cada día se hace todo lo que toque, siempre con «Bien».
    let cards = Array.from({ length: 70 }, (_, i) => ({
      id: `c${String(i).padStart(2, '0')}`,
      created_at: at(i).toISOString(),
      ...newCardState(T0),
    }));
    const perDay: { fresh: number; total: number }[] = [];

    for (let day = 0; day < 7; day++) {
      let now = at(day * DAY);
      const startOfDay = now;
      let fresh = 0;
      let total = 0;
      // La sesión se alarga mientras haya algo vencido (los pasos de 1 y 10 min vuelven).
      for (let round = 0; round < 50; round++) {
        const queue = buildQueue(cards, { now, newDoneToday: fresh });
        if (queue.length === 0) break;
        for (const item of queue) {
          if (item.state === 0) fresh++;
          total++;
          const next = review(item, 3, now).state;
          cards = cards.map((c) => (c.id === item.id ? { ...c, ...next } : c));
          now = new Date(now.getTime() + 8_000);
        }
        now = new Date(now.getTime() + 10 * MINUTE);
      }
      expect(now.getTime() - startOfDay.getTime()).toBeLessThan(DAY);
      perDay.push({ fresh, total });
    }

    expect(perDay.map((d) => d.fresh)).toEqual([10, 10, 10, 10, 10, 10, 10]);
    // Cada nueva pide dos respuestas el primer día; los repasos de días anteriores se van
    // espaciando, así que el total diario se mantiene acotado.
    expect(Math.max(...perDay.map((d) => d.total))).toBeLessThanOrEqual(45);
  });
});
