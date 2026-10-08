import type { CefrLevel } from '@/features/level/lib/bands';

/**
 * Velocidad lectora objetivo por nivel, en palabras por minuto y con ≥ 75 % de comprensión
 * (docs/01-pedagogia/04-reading.md §5).
 */
export const READING_WPM_TARGET: Record<CefrLevel, { min: number; max: number }> = {
  A1: { min: 60, max: 90 },
  A2: { min: 80, max: 110 },
  B1: { min: 100, max: 150 },
  B2: { min: 140, max: 180 },
  C1: { min: 170, max: 220 },
  C2: { min: 200, max: 250 },
};

/** Segundos del vistazo inicial (60–90 s, contrarreloj suave). */
export const SKIM_SECONDS = 75;
