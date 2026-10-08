// Navegación por frases sobre los tiempos del audio. Lógica pura.

export interface TimeRange {
  start: number;
  end: number;
}

/**
 * Índice del segmento que suena en `time` (búsqueda binaria). En una pausa entre dos
 * segmentos devuelve el anterior; antes del primero, 0.
 */
export function segmentAt(segments: readonly TimeRange[], time: number): number {
  let low = 0;
  let high = segments.length - 1;
  let found = 0;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if ((segments[mid]?.start ?? Infinity) <= time) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found;
}

/**
 * Índice de la palabra activa en `time` dentro de una lista plana de inicios ordenados,
 * o -1 si aún no ha empezado ninguna.
 */
export function wordAt(starts: readonly number[], time: number): number {
  let low = 0;
  let high = starts.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if ((starts[mid] ?? Infinity) <= time) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found;
}

export const MIN_RATE = 0.5;
export const MAX_RATE = 1.5;
export const RATE_STEP = 0.05;

/** Velocidad dentro de 0,5–1,5× y en pasos de 0,05 (sin arrastrar errores de coma flotante). */
export function clampRate(rate: number): number {
  const stepped = Math.round(rate / RATE_STEP) * RATE_STEP;
  return Number(Math.min(MAX_RATE, Math.max(MIN_RATE, stepped)).toFixed(2));
}

/** URL pública de un audio: base (R2 o /dev-audio) + ruta de la lección. */
export function audioUrl(base: string, src: string): string {
  return `${base.replace(/\/+$/, '')}/${src.replace(/^\/+/, '')}`;
}
