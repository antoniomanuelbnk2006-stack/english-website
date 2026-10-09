import { startOfWeek, todayMadrid, type DayString } from '@/lib/dates';
import { CRITERIA, type Criterion, type Scores } from './schema';

// Historial de writings: evolución de las notas por criterio (07-writing §2.2, paso 7) y la
// cadencia semanal (§2.5: dos writings por semana).

export const WEEKLY_TARGET = 2;

export interface HistoryEntry {
  id: string;
  /** Instante de la entrega (ISO). */
  createdAt: string;
  /** Quién puso las notas: la IA o el propio usuario. */
  kind: 'ai' | 'self';
  scores: Scores | null;
}

export interface ScorePoint {
  id: string;
  day: DayString;
  kind: 'ai' | 'self';
  score: number;
}

/** Las notas de cada criterio, de la más antigua a la más reciente. */
export function criterionSeries(entries: readonly HistoryEntry[]): Record<Criterion, ScorePoint[]> {
  const scored = entries
    .filter((entry): entry is HistoryEntry & { scores: Scores } => entry.scores !== null)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const series = {} as Record<Criterion, ScorePoint[]>;
  for (const criterion of CRITERIA) {
    series[criterion] = scored.map((entry) => ({
      id: entry.id,
      day: todayMadrid(new Date(entry.createdAt)),
      kind: entry.kind,
      score: entry.scores[criterion],
    }));
  }
  return series;
}

/** Media de cada criterio en los últimos `last` writings con nota (un decimal). */
export function recentAverages(
  entries: readonly HistoryEntry[],
  last = 5,
): Record<Criterion, number | null> {
  const series = criterionSeries(entries);
  const averages = {} as Record<Criterion, number | null>;
  for (const criterion of CRITERIA) {
    const recent = series[criterion].slice(-last);
    averages[criterion] =
      recent.length === 0
        ? null
        : Math.round((recent.reduce((sum, point) => sum + point.score, 0) / recent.length) * 10) /
          10;
  }
  return averages;
}

/** El criterio con la media reciente más baja: por ahí conviene empezar. `null` sin notas. */
export function weakestCriterion(entries: readonly HistoryEntry[]): Criterion | null {
  const averages = recentAverages(entries);
  let weakest: Criterion | null = null;
  for (const criterion of CRITERIA) {
    const value = averages[criterion];
    if (value === null) continue;
    if (weakest === null || value < (averages[weakest] ?? Infinity)) weakest = criterion;
  }
  return weakest;
}

/** Writings entregados en la semana (de lunes a domingo, en Madrid) del día dado. */
export function writingsThisWeek(entries: readonly HistoryEntry[], today: DayString): number {
  const week = startOfWeek(today);
  return entries.filter((entry) => startOfWeek(todayMadrid(new Date(entry.createdAt))) === week)
    .length;
}
