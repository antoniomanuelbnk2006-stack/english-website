import type { LexemeStatus } from './known';

// Promoción implícita (docs/01-pedagogia/05-vocabulario-y-srs.md §4): una palabra «nueva» pasa
// a «conocida» si te la encuentras en 3 textos o audios distintos sin consultarla y sin
// fallarla en un dictado. Lógica pura.

/** Encuentros seguidos sin consultar que hacen falta para dar una palabra por conocida. */
export const IMPLICIT_PROMOTION_AFTER = 3;

export interface LexemeRow {
  lemma: string;
  status: LexemeStatus;
  /** Encuentros seguidos sin consultarla (vuelve a 0 al consultarla o fallarla). */
  seen_count: number;
  /** Veces que se ha consultado. */
  lookup_count: number;
}

export interface LexemeChange extends LexemeRow {
  /** Presente solo si la palabra se ha promovido. */
  source?: 'implicit';
}

/**
 * Efecto de terminar una lección sobre las palabras del léxico que aparecen en ella.
 * Devuelve solo las filas que cambian.
 */
export function applyExposure(
  rows: readonly LexemeRow[],
  {
    lessonLemmas,
    lookedUp,
    failed,
    promote,
  }: {
    /** Lemas contables de la lección. */
    lessonLemmas: ReadonlySet<string>;
    /** Lemas consultados o marcados durante la lección. */
    lookedUp: ReadonlySet<string>;
    /** Lemas de palabras falladas en el dictado. */
    failed: ReadonlySet<string>;
    /** Ajuste del usuario: ¿se promueve sola una palabra a «conocida»? */
    promote: boolean;
  },
): LexemeChange[] {
  const changes: LexemeChange[] = [];
  for (const row of rows) {
    if (!lessonLemmas.has(row.lemma)) continue;

    if (lookedUp.has(row.lemma) || failed.has(row.lemma)) {
      changes.push({
        ...row,
        seen_count: 0,
        lookup_count: row.lookup_count + (lookedUp.has(row.lemma) ? 1 : 0),
      });
      continue;
    }

    const seen = row.seen_count + 1;
    if (row.status === 'new' && promote && seen >= IMPLICIT_PROMOTION_AFTER) {
      changes.push({ ...row, status: 'known', source: 'implicit', seen_count: seen });
    } else {
      changes.push({ ...row, seen_count: seen });
    }
  }
  return changes;
}
