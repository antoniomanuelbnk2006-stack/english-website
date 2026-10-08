import { CEFR_LEVELS, type CefrLevel } from '@/features/level/lib/bands';

// Qué palabras se dan por conocidas (docs/01-pedagogia/05-vocabulario-y-srs.md §2, §4 y §5). Lógica pura.

export type LexemeStatus = 'new' | 'learning' | 'known' | 'ignored';

/** Palabras gramaticales (the, of, to…): conocidas desde A1. */
export const FUNCTION_POS: ReadonlySet<string> = new Set([
  'DET',
  'ADP',
  'PRON',
  'AUX',
  'CCONJ',
  'SCONJ',
  'PART',
]);

export interface KnownInput {
  /** Estado en el léxico personal, si la palabra ya está en él. */
  status?: LexemeStatus;
  /** Categoría gramatical (UPOS) con la que aparece. */
  pos?: string;
  /** Nivel MCER del lema según las listas; `undefined` si no está en ninguna. */
  level?: CefrLevel;
  /** Nivel del usuario (confirmado o, si no hay, declarado). */
  userLevel: CefrLevel;
}

/**
 * Lo que diga el léxico personal manda. Si la palabra aún no está en él, se da por conocida
 * cuando es gramatical o su nivel no supera el del usuario: es el punto de partida hasta que
 * el test de nivel (fase 5) siembre el léxico con datos reales.
 */
export function isKnown({ status, pos, level, userLevel }: KnownInput): boolean {
  if (status === 'known' || status === 'ignored') return true;
  if (status === 'new' || status === 'learning') return false;
  if (pos !== undefined && FUNCTION_POS.has(pos)) return true;
  if (level === undefined) return false;
  return CEFR_LEVELS.indexOf(level) <= CEFR_LEVELS.indexOf(userLevel);
}

export interface CountableToken {
  /** Lema. */
  l: string;
  /** Categoría gramatical. */
  p: string;
  /** ¿Cuenta para la cobertura? (no puntuación, números ni nombres propios). */
  w: boolean;
  /** Veces que aparece, si los tokens vienen ya agrupados (por defecto, 1). */
  n?: number;
}

/** Lemas conocidos entre los tokens contables de un texto. */
export function knownLemmas(
  tokens: readonly CountableToken[],
  context: {
    statusOf: (lemma: string) => LexemeStatus | undefined;
    levelOf: (lemma: string) => CefrLevel | undefined;
    userLevel: CefrLevel;
  },
): Set<string> {
  const known = new Set<string>();
  const unknown = new Set<string>();
  for (const token of tokens) {
    if (!token.w || known.has(token.l) || unknown.has(token.l)) continue;
    const yes = isKnown({
      status: context.statusOf(token.l),
      pos: token.p,
      level: context.levelOf(token.l),
      userLevel: context.userLevel,
    });
    (yes ? known : unknown).add(token.l);
  }
  return known;
}

/**
 * Cobertura léxica: tokens contables conocidos / tokens contables.
 * Devuelve 1 si el texto no tiene tokens contables.
 */
export function coverage(tokens: readonly CountableToken[], known: ReadonlySet<string>): number {
  let total = 0;
  let hits = 0;
  for (const token of tokens) {
    if (!token.w) continue;
    const weight = token.n ?? 1;
    total += weight;
    if (known.has(token.l) || FUNCTION_POS.has(token.p)) hits += weight;
  }
  return total === 0 ? 1 : hits / total;
}
