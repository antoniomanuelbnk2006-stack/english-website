import { CEFR_LEVELS, type CefrLevel } from '@/features/level/lib/bands';

// Filtros y agrupación de las bibliotecas de lecciones. Lógica pura.

export const LESSON_STATUSES = ['new', 'started', 'done'] as const;
export type LessonStatus = (typeof LESSON_STATUSES)[number];

export interface LibraryLesson {
  id: string;
  level: CefrLevel;
  unit: string;
  topic: string;
}

export interface LibraryFilters {
  level?: CefrLevel;
  status?: LessonStatus;
  topic?: string;
}

type SearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Valor de `?nivel=` que pide ver todos los niveles cuando hay un nivel por defecto. */
export const ALL_LEVELS = 'todos';

/**
 * Lee los filtros de la URL (`?nivel=B1&estado=new&tema=games`) ignorando valores que no valen.
 * Con `defaultLevel` (el nivel del usuario), una URL sin `nivel` filtra por ese nivel y
 * `?nivel=todos` los enseña todos.
 */
export function parseFilters(
  searchParams: SearchParams,
  topics: readonly string[],
  defaultLevel?: CefrLevel,
): LibraryFilters {
  const level = first(searchParams.nivel);
  const status = first(searchParams.estado);
  const topic = first(searchParams.tema);
  return {
    level: (CEFR_LEVELS as readonly string[]).includes(level ?? '')
      ? (level as CefrLevel)
      : level === ALL_LEVELS
        ? undefined
        : defaultLevel,
    status: (LESSON_STATUSES as readonly string[]).includes(status ?? '')
      ? (status as LessonStatus)
      : undefined,
    topic: topic !== undefined && topics.includes(topic) ? topic : undefined,
  };
}

/** Parámetros de URL para unos filtros, sin los vacíos (ni el nivel, si es el de por defecto). */
export function filtersToQuery(
  filters: LibraryFilters,
  defaultLevel?: CefrLevel,
): Record<string, string> {
  const query: Record<string, string> = {};
  if (filters.level && filters.level !== defaultLevel) query.nivel = filters.level;
  if (!filters.level && defaultLevel) query.nivel = ALL_LEVELS;
  if (filters.status) query.estado = filters.status;
  if (filters.topic) query.tema = filters.topic;
  return query;
}

export function statusOf(progress: { status: 'started' | 'completed' } | undefined): LessonStatus {
  if (!progress) return 'new';
  return progress.status === 'completed' ? 'done' : 'started';
}

export function filterLessons<T extends LibraryLesson>(
  lessons: readonly T[],
  statusById: ReadonlyMap<string, LessonStatus>,
  filters: LibraryFilters,
): T[] {
  return lessons.filter(
    (lesson) =>
      (!filters.level || lesson.level === filters.level) &&
      (!filters.topic || lesson.topic === filters.topic) &&
      (!filters.status || (statusById.get(lesson.id) ?? 'new') === filters.status),
  );
}

export interface UnitGroup<T> {
  unit: string;
  lessons: T[];
}

/** Agrupa por unidad del currículo, en orden de nivel y unidad (a1-u01 … c2-u08). */
export function groupByUnit<T extends LibraryLesson>(lessons: readonly T[]): UnitGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const lesson of lessons) {
    const group = groups.get(lesson.unit) ?? [];
    group.push(lesson);
    groups.set(lesson.unit, group);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([unit, items]) => ({
      unit,
      lessons: [...items].sort((a, b) => a.id.localeCompare(b.id)),
    }));
}
