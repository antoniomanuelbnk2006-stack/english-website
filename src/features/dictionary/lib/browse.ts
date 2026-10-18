import { CEFR_LEVELS, type CefrLevel } from '@/features/level/lib/bands';
import type { LexemeStatus } from '@/features/lexicon/lib/known';
import { lemmaKey, type DictionaryEntry } from '@/lib/content/dictionary-schema';

// Explorar el mazo de palabras: filtros, búsqueda, páginas y qué estudiar. Lógica pura.

/** Cómo va una palabra del mazo para el usuario. */
export type WordState = 'todo' | 'learning' | 'known' | 'ignored';

export const STATE_FILTERS = ['all', 'todo', 'learning', 'known'] as const;
export type StateFilter = (typeof STATE_FILTERS)[number];

export const PAGE_SIZE = 40;
export const STUDY_BATCH = 12;

/** Estado del mazo a partir del léxico personal: «nueva» o sin fila es «por aprender». */
export function stateOf(status: LexemeStatus | undefined): WordState {
  if (status === 'learning' || status === 'known' || status === 'ignored') return status;
  return 'todo';
}

export interface BrowseParams {
  level: CefrLevel;
  query: string;
  state: StateFilter;
  page: number;
}

type RawParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Parámetros de la URL (`?nivel=B2&q=…&estado=…&pagina=…`), con el nivel del usuario por defecto. */
export function parseBrowseParams(raw: RawParams, userLevel: CefrLevel): BrowseParams {
  const level = CEFR_LEVELS.find((candidate) => candidate === first(raw.nivel)) ?? userLevel;
  const state = STATE_FILTERS.find((candidate) => candidate === first(raw.estado)) ?? 'all';
  const page = Number.parseInt(first(raw.pagina) ?? '1', 10);
  return {
    level,
    query: (first(raw.q) ?? '').trim().slice(0, 60),
    state,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/** Parámetros para un enlace: solo los que no son el valor por defecto. */
export function toQuery(params: BrowseParams, userLevel: CefrLevel): Record<string, string> {
  return {
    ...(params.level === userLevel ? {} : { nivel: params.level }),
    ...(params.query ? { q: params.query } : {}),
    ...(params.state === 'all' ? {} : { estado: params.state }),
    ...(params.page > 1 ? { pagina: String(params.page) } : {}),
  };
}

/** Sin tildes ni mayúsculas, para buscar «accion» y encontrar «acción». */
export function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** La búsqueda vale por el principio de la palabra en inglés o por cualquier parte de la traducción. */
export function matchesQuery(entry: DictionaryEntry, query: string): boolean {
  const needle = fold(query.trim());
  if (!needle) return true;
  if (fold(entry.lemma).startsWith(needle)) return true;
  return fold(entry.translation)
    .split(/[^a-zñ]+/)
    .some((word) => word.startsWith(needle));
}

export function filterEntries(
  entries: readonly DictionaryEntry[],
  statuses: ReadonlyMap<string, LexemeStatus>,
  filters: Pick<BrowseParams, 'query' | 'state'>,
): DictionaryEntry[] {
  return entries.filter((entry) => {
    if (!matchesQuery(entry, filters.query)) return false;
    if (filters.state === 'all') return true;
    return stateOf(statuses.get(lemmaKey(entry.lemma))) === filters.state;
  });
}

export interface Page<T> {
  items: T[];
  page: number;
  pages: number;
  total: number;
}

/** Una página de resultados; una página fuera de rango se lleva a la última. */
export function paginate<T>(items: readonly T[], page: number, size = PAGE_SIZE): Page<T> {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, page), pages);
  return {
    items: items.slice((current - 1) * size, current * size),
    page: current,
    pages,
    total: items.length,
  };
}

export interface DeckSummary {
  total: number;
  known: number;
  learning: number;
  todo: number;
}

/** Cuántas palabras del nivel se saben, cuántas están en repaso y cuántas quedan. */
export function summarize(
  entries: readonly DictionaryEntry[],
  statuses: ReadonlyMap<string, LexemeStatus>,
): DeckSummary {
  const summary: DeckSummary = { total: entries.length, known: 0, learning: 0, todo: 0 };
  for (const entry of entries) {
    const state = stateOf(statuses.get(lemmaKey(entry.lemma)));
    if (state === 'known') summary.known += 1;
    else if (state === 'learning') summary.learning += 1;
    else if (state === 'todo') summary.todo += 1;
  }
  return summary;
}

/**
 * Siguiente tanda para estudiar: palabras aún por aprender, primero las más frecuentes (las que
 * más vas a encontrarte) y, dentro de las que no tienen frecuencia, por orden alfabético.
 */
export function pickStudyBatch(
  entries: readonly DictionaryEntry[],
  statuses: ReadonlyMap<string, LexemeStatus>,
  size = STUDY_BATCH,
): DictionaryEntry[] {
  return entries
    .filter((entry) => stateOf(statuses.get(lemmaKey(entry.lemma))) === 'todo')
    .sort(
      (a, b) =>
        (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER) ||
        a.lemma.localeCompare(b.lemma, 'en'),
    )
    .slice(0, size);
}
