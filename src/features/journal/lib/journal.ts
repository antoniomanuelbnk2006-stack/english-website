import { z } from 'zod';
import { CEFR_LEVELS } from '@/features/level/lib/bands';
import { startOfWeek, type DayString } from '@/lib/dates';

// Diario de input: lo que se escucha y se lee, en la app y fuera. Lógica pura.

export const INPUT_KINDS = [
  'intensive_listening',
  'extensive_listening',
  'intensive_reading',
  'extensive_reading',
] as const;
export type InputKind = (typeof INPUT_KINDS)[number];

/** Minutos que ofrece el registro rápido. */
export const QUICK_MINUTES = [10, 20, 30, 60] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? undefined : value))
    .optional();

/** Registro manual de contenido externo (podcast, vídeo, libro). */
export const LogInput = z.object({
  kind: z.enum(['extensive_listening', 'extensive_reading']),
  minutes: z.number().min(1).max(600),
  title: optionalText(200),
  // Solo http(s): el enlace se pinta como <a> y no debe poder ser `javascript:`.
  url: optionalText(2000).refine(
    (value) => value === undefined || /^https?:\/\/\S+$/i.test(value),
    'debe empezar por http',
  ),
  perceivedLevel: z.enum(CEFR_LEVELS).optional(),
  words: z.number().int().min(0).max(500_000).optional(),
});
export type LogInput = z.infer<typeof LogInput>;

export interface JournalEntry {
  id: number;
  kind: InputKind;
  source: 'app' | 'external';
  minutes: number;
  words: number | null;
  title: string | null;
  url: string | null;
  perceivedLevel: string | null;
  loggedOn: DayString;
}

export const isListening = (kind: InputKind) => kind.endsWith('listening');

export interface WeekTotals {
  listening: number;
  reading: number;
  total: number;
  words: number;
}

/** Minutos de la semana (lunes a domingo) a la que pertenece `today`. */
export function weekTotals(entries: readonly JournalEntry[], today: DayString): WeekTotals {
  const monday = startOfWeek(today);
  const totals: WeekTotals = { listening: 0, reading: 0, total: 0, words: 0 };
  for (const entry of entries) {
    if (startOfWeek(entry.loggedOn) !== monday) continue;
    if (isListening(entry.kind)) totals.listening += entry.minutes;
    else totals.reading += entry.minutes;
    totals.total += entry.minutes;
    totals.words += entry.words ?? 0;
  }
  return totals;
}

/** Agrupa por día, del más reciente al más antiguo. */
export function groupByDay(
  entries: readonly JournalEntry[],
): { day: DayString; entries: JournalEntry[] }[] {
  const groups = new Map<DayString, JournalEntry[]>();
  for (const entry of entries) {
    groups.set(entry.loggedOn, [...(groups.get(entry.loggedOn) ?? []), entry]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([day, items]) => ({ day, entries: items.sort((a, b) => b.id - a.id) }));
}

/** Minutos → horas y minutos enteros, para mostrar «2 h 15 min». */
export function splitMinutes(minutes: number): { h: number; m: number } {
  const total = Math.round(minutes);
  return { h: Math.floor(total / 60), m: total % 60 };
}
