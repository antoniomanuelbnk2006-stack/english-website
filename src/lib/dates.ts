import { TZDate } from '@date-fns/tz';

/**
 * El «día» del usuario (rachas, plan, límites, diario) se calcula siempre en Europe/Madrid.
 * Todas las funciones reciben `now` para ser puras y testeables.
 */
export const APP_TIME_ZONE = 'Europe/Madrid';

/** Día de calendario en formato 'YYYY-MM-DD'. */
export type DayString = string;

const pad = (n: number) => String(n).padStart(2, '0');

function inMadrid(now: Date): TZDate {
  return new TZDate(now.getTime(), APP_TIME_ZONE);
}

function toDayString(year: number, monthIndex: number, day: number): DayString {
  return `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
}

function parseDay(day: DayString): [year: number, monthIndex: number, day: number] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) throw new Error(`Día no válido: «${day}» (se esperaba YYYY-MM-DD)`);
  return [Number(match[1]), Number(match[2]) - 1, Number(match[3])];
}

/** Día actual en Madrid. */
export function todayMadrid(now: Date = new Date()): DayString {
  const d = inMadrid(now);
  return toDayString(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Instante (UTC) en el que empieza el día `day` en Madrid. */
export function startOfDayMadrid(day: DayString): Date {
  const [y, m, d] = parseDay(day);
  return new Date(new TZDate(y, m, d, 0, 0, 0, 0, APP_TIME_ZONE).getTime());
}

/** Instante (UTC) en el que empezó el día de hoy en Madrid. */
export function startOfTodayMadrid(now: Date = new Date()): Date {
  return startOfDayMadrid(todayMadrid(now));
}

/** Instante (UTC) en el que empezó el mes en curso en Madrid. */
export function startOfMonthMadrid(now: Date = new Date()): Date {
  const d = inMadrid(now);
  return startOfDayMadrid(toDayString(d.getFullYear(), d.getMonth(), 1));
}

/** Suma (o resta) días de calendario, sin que afecten los cambios de hora. */
export function addDays(day: DayString, amount: number): DayString {
  const [y, m, d] = parseDay(day);
  const utc = new Date(Date.UTC(y, m, d + amount));
  return toDayString(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
}

/** Día de la semana ISO: 1 = lunes … 7 = domingo. */
export function weekdayOf(day: DayString): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  const [y, m, d] = parseDay(day);
  const js = new Date(Date.UTC(y, m, d)).getUTCDay(); // 0 = domingo
  return (js === 0 ? 7 : js) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

/** Lunes de la semana a la que pertenece `day`. */
export function startOfWeek(day: DayString): DayString {
  return addDays(day, 1 - weekdayOf(day));
}

/** Días transcurridos de `from` a `to` (negativo si `to` es anterior). */
export function daysBetween(from: DayString, to: DayString): number {
  const [fy, fm, fd] = parseDay(from);
  const [ty, tm, td] = parseDay(to);
  return Math.round((Date.UTC(ty, tm, td) - Date.UTC(fy, fm, fd)) / 86_400_000);
}
