import type { ScaleTable } from '@/lib/content/exam-formats';

// Puntos de un simulacro → nota orientativa en la escala Cambridge. Las tablas de Cambridge dan
// cuatro puntos de referencia por prueba; entre ellos se interpola en línea recta. Lógica pura.

/** La nota máxima de cada examen está 30 puntos por encima del aprobado (190 en B2 First). */
const TOP_ABOVE_PASS = 30;

/**
 * Nota en la escala Cambridge para unos puntos, o `null` si quedan por debajo de la nota
 * mínima que el examen informa.
 */
export function toScale(table: ScaleTable, marks: number, pass: number): number | null {
  const points: (readonly [number, number])[] = [
    [table.total, pass + TOP_ABOVE_PASS],
    ...table.anchors,
  ];
  if (marks >= table.total) return pass + TOP_ABOVE_PASS;
  for (let index = 0; index < points.length - 1; index++) {
    const high = points[index];
    const low = points[index + 1];
    if (!high || !low) break;
    if (marks >= low[0]) {
      const ratio = (marks - low[0]) / (high[0] - low[0]);
      return Math.round(low[1] + ratio * (high[1] - low[1]));
    }
  }
  return null;
}

/**
 * Qué significa una nota de la escala en un examen:
 * `grade_a` (certifica el nivel de arriba), `grade_b`, `grade_c` (aprobado),
 * `level_below` (certifica el nivel de abajo) o `below` (no certifica nada).
 */
export type ScaleBand = 'grade_a' | 'grade_b' | 'grade_c' | 'level_below' | 'below';

export function scaleBand(scale: number | null, pass: number): ScaleBand {
  if (scale === null) return 'below';
  if (scale >= pass + 20) return 'grade_a';
  if (scale >= pass + 13) return 'grade_b';
  if (scale >= pass) return 'grade_c';
  if (scale >= pass - 20) return 'level_below';
  return 'below';
}

export const isPass = (band: ScaleBand) =>
  band === 'grade_a' || band === 'grade_b' || band === 'grade_c';

/** Sin escala oficial (A1), se aprueba con el 60 %: el corte habitual de Cambridge. */
export const PASS_RATIO = 0.6;
