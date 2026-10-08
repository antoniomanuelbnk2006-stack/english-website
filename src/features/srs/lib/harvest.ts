import { CEFR_LEVELS, type CefrLevel } from '@/features/level/lib/bands';
import type { LexemeStatus } from '@/features/lexicon/lib/known';
import type { Cause } from '@/features/listening/lib/dictation';
import { kindOfEntry } from './cards';

// Cosecha: qué merece una tarjeta al terminar una lección
// (docs/01-pedagogia/05-vocabulario-y-srs.md §8). Lógica pura.

/** Tarjetas nuevas como mucho por lección; el resto queda como sugerencia. */
export const HARVEST_LIMIT = { listening: 5, reading: 8 } as const;

export type HarvestReason =
  /** Frase fallada en el dictado con palabras que conoces: tu punto débil. */
  | 'dictation'
  /** La consultaste o la marcaste como desconocida. */
  | 'marked'
  /** Palabra de tu nivel o del siguiente. */
  | 'level'
  /** Expresión útil. */
  | 'chunk'
  /** Rara o técnica: basta con el glosario. */
  | 'rare';

export interface HarvestCandidate {
  /** `audio:s16`, `word:release`, `chunk:keep up with`. */
  key: string;
  kind: 'audio' | 'word' | 'chunk';
  lemma?: string;
  segmentId?: string;
  reason: HarvestReason;
  /** Preseleccionada (dentro del límite de la lección). */
  selected: boolean;
}

export interface HarvestInput {
  skill: 'listening' | 'reading';
  userLevel: CefrLevel;
  glossary: readonly { lemma: string; pos: string; cefr?: CefrLevel }[];
  levelOf: (lemma: string) => CefrLevel | undefined;
  statusOf: (lemma: string) => LexemeStatus | undefined;
  /** ¿Existe ya una tarjeta con esta clave? */
  hasCard: (key: string) => boolean;
  /** Fallos del dictado de esta lección. */
  failures?: readonly { segmentId: string; cause: Cause }[];
  /** Lemas consultados o marcados como desconocidos durante la lección. */
  marked?: ReadonlySet<string>;
}

const rank = (level: CefrLevel) => CEFR_LEVELS.indexOf(level);

export function harvest(input: HarvestInput): HarvestCandidate[] {
  const marked = input.marked ?? new Set<string>();
  const reach = Math.min(CEFR_LEVELS.length - 1, rank(input.userLevel) + 1);
  const out: Omit<HarvestCandidate, 'selected'>[] = [];
  const seen = new Set<string>();
  const add = (candidate: Omit<HarvestCandidate, 'selected'>) => {
    if (seen.has(candidate.key) || input.hasCard(candidate.key)) return;
    seen.add(candidate.key);
    out.push(candidate);
  };

  // 1. Frases falladas en el dictado, salvo que el problema fuera una palabra desconocida
  //    (eso es vocabulario, no oído).
  for (const failure of input.failures ?? []) {
    if (failure.cause === 'unknown_word') continue;
    add({
      key: `audio:${failure.segmentId}`,
      kind: 'audio',
      segmentId: failure.segmentId,
      reason: 'dictation',
    });
  }

  const entries = input.glossary
    .map((entry, order) => ({
      ...entry,
      order,
      kind: kindOfEntry(entry),
      level: entry.cefr ?? input.levelOf(entry.lemma),
    }))
    .filter((entry) => {
      const status = input.statusOf(entry.lemma);
      return status !== 'known' && status !== 'ignored' && status !== 'learning';
    });
  const candidate = (entry: (typeof entries)[number], reason: HarvestReason) =>
    add({ key: `${entry.kind}:${entry.lemma}`, kind: entry.kind, lemma: entry.lemma, reason });

  // 2. Lo que tú mismo señalaste.
  for (const entry of entries) if (marked.has(entry.lemma)) candidate(entry, 'marked');

  // 3. Palabras de tu nivel o del siguiente, las más básicas primero.
  const inReach = (entry: (typeof entries)[number]) =>
    entry.level !== undefined && rank(entry.level) <= reach;
  entries
    .filter((entry) => entry.kind === 'word' && inReach(entry))
    .sort((a, b) => rank(a.level ?? 'C2') - rank(b.level ?? 'C2') || a.order - b.order)
    .forEach((entry) => candidate(entry, 'level'));

  // 4. Expresiones: no tienen nivel en las listas; las elige quien escribe la lección.
  for (const entry of entries) if (entry.kind === 'chunk') candidate(entry, 'chunk');

  // 5. Raras o técnicas: se ofrecen, pero sin marcar.
  for (const entry of entries) candidate(entry, 'rare');

  let left: number = HARVEST_LIMIT[input.skill];
  return out.map((item) => {
    const selected = item.reason !== 'rare' && left > 0;
    if (selected) left--;
    return { ...item, selected };
  });
}
