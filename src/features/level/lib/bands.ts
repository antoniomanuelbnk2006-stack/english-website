// Escala interna de Señal (docs/01-pedagogia/01-marco-mcer.md §4): cada banda MCER ocupa 200 puntos.

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

export const BAND_WIDTH = 200;
const FIRST_BAND_START = 600;

/** Rating inicial cuando aún no hay datos: centro de B1, el nivel declarado del dueño. */
export const DEFAULT_RATING = 1100;

export function bandStart(level: CefrLevel): number {
  return FIRST_BAND_START + CEFR_LEVELS.indexOf(level) * BAND_WIDTH;
}

export function bandCenter(level: CefrLevel): number {
  return bandStart(level) + BAND_WIDTH / 2;
}

export function levelFromRating(rating: number): CefrLevel {
  const index = Math.floor((rating - FIRST_BAND_START) / BAND_WIDTH);
  const clamped = Math.min(CEFR_LEVELS.length - 1, Math.max(0, index));
  return CEFR_LEVELS[clamped] ?? 'A1';
}

export function nextLevel(level: CefrLevel): CefrLevel | null {
  return CEFR_LEVELS[CEFR_LEVELS.indexOf(level) + 1] ?? null;
}

/** Progreso dentro de la banda, de 0 a 1: `(rating − inicio_banda) / 200`. */
export function progressInBand(rating: number): number {
  const progress = (rating - bandStart(levelFromRating(rating))) / BAND_WIDTH;
  return Math.min(1, Math.max(0, progress));
}

export interface LevelSummary {
  level: CefrLevel;
  next: CefrLevel | null;
  /** Porcentaje entero hacia el nivel siguiente (0–100). */
  percent: number;
}

/** «B1 · 63 % hacia B2» para un rating de 1126. */
export function summarizeRating(rating: number): LevelSummary {
  const level = levelFromRating(rating);
  // Se multiplica antes de dividir: 0,57 × 100 da 56,999… en coma flotante.
  const percent = Math.floor(((rating - bandStart(level)) * 100) / BAND_WIDTH);
  return { level, next: nextLevel(level), percent: Math.min(100, Math.max(0, percent)) };
}

/** Con menos de 30 ítems, o más de 21 días sin responder, la estimación es de baja confianza. */
export function isLowConfidence(itemsCount: number, daysSinceLastItem: number | null): boolean {
  return itemsCount < 30 || daysSinceLastItem === null || daysSinceLastItem > 21;
}
