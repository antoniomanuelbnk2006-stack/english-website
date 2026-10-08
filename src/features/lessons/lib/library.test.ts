import { describe, expect, it } from 'vitest';
import {
  filterLessons,
  filtersToQuery,
  groupByUnit,
  parseFilters,
  statusOf,
  type LessonStatus,
} from './library';

const lessons = [
  { id: 'b1-rea-003', level: 'B1' as const, unit: 'b1-u02', topic: 'science-space' },
  { id: 'b2-rea-001', level: 'B2' as const, unit: 'b2-u01', topic: 'work-tech' },
  { id: 'b1-rea-001', level: 'B1' as const, unit: 'b1-u03', topic: 'games' },
  { id: 'b1-rea-002', level: 'B1' as const, unit: 'b1-u02', topic: 'science-space' },
];
const status = new Map<string, LessonStatus>([
  ['b1-rea-001', 'done'],
  ['b1-rea-002', 'started'],
]);
const topics = ['games', 'science-space', 'work-tech'];

describe('parseFilters', () => {
  it('lee nivel, estado y tema de la URL', () => {
    expect(parseFilters({ nivel: 'B1', estado: 'done', tema: 'games' }, topics)).toEqual({
      level: 'B1',
      status: 'done',
      topic: 'games',
    });
  });

  it('ignora valores desconocidos y se queda con el primero si se repiten', () => {
    expect(parseFilters({ nivel: 'Z9', estado: 'borrada', tema: 'cocina' }, topics)).toEqual({
      level: undefined,
      status: undefined,
      topic: undefined,
    });
    expect(parseFilters({ nivel: ['B2', 'B1'] }, topics).level).toBe('B2');
  });

  it('filtersToQuery es su inversa y omite los vacíos', () => {
    expect(filtersToQuery({ level: 'B1', status: 'new' })).toEqual({ nivel: 'B1', estado: 'new' });
    expect(filtersToQuery({})).toEqual({});
  });
});

describe('filterLessons', () => {
  const ids = (filters: Parameters<typeof filterLessons>[2]) =>
    filterLessons(lessons, status, filters).map((l) => l.id);

  it('sin filtros devuelve todo', () => {
    expect(ids({})).toHaveLength(4);
  });

  it('combina nivel, tema y estado', () => {
    expect(ids({ level: 'B1' })).toEqual(['b1-rea-003', 'b1-rea-001', 'b1-rea-002']);
    expect(ids({ level: 'B1', topic: 'science-space' })).toEqual(['b1-rea-003', 'b1-rea-002']);
    expect(ids({ status: 'done' })).toEqual(['b1-rea-001']);
    expect(ids({ level: 'B1', status: 'started', topic: 'games' })).toEqual([]);
  });

  it('una lección sin progreso cuenta como nueva', () => {
    expect(ids({ status: 'new' })).toEqual(['b1-rea-003', 'b2-rea-001']);
    expect(statusOf(undefined)).toBe('new');
    expect(statusOf({ status: 'started' })).toBe('started');
    expect(statusOf({ status: 'completed' })).toBe('done');
  });
});

describe('groupByUnit', () => {
  it('agrupa por unidad en orden de nivel y unidad, con las lecciones ordenadas', () => {
    expect(groupByUnit(lessons).map((g) => [g.unit, g.lessons.map((l) => l.id)])).toEqual([
      ['b1-u02', ['b1-rea-002', 'b1-rea-003']],
      ['b1-u03', ['b1-rea-001']],
      ['b2-u01', ['b2-rea-001']],
    ]);
  });
});
