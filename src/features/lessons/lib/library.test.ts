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

describe('filtros con el nivel del usuario por defecto', () => {
  it('sin nivel en la URL (o con uno que no vale) se filtra por el del usuario', () => {
    expect(parseFilters({}, topics, 'B2').level).toBe('B2');
    expect(parseFilters({ nivel: 'Z9' }, topics, 'B2').level).toBe('B2');
  });

  it('«todos» los enseña todos y otro nivel manda sobre el del usuario', () => {
    expect(parseFilters({ nivel: 'todos' }, topics, 'B2').level).toBeUndefined();
    expect(parseFilters({ nivel: 'A2' }, topics, 'B2').level).toBe('A2');
  });

  it('la URL solo lleva el nivel cuando no es el del usuario', () => {
    expect(filtersToQuery({ level: 'B2' }, 'B2')).toEqual({});
    expect(filtersToQuery({ level: 'A2' }, 'B2')).toEqual({ nivel: 'A2' });
    expect(filtersToQuery({ status: 'done' }, 'B2')).toEqual({ nivel: 'todos', estado: 'done' });
  });

  it('ida y vuelta: lo que se escribe en la URL se vuelve a leer igual', () => {
    for (const level of ['A2', 'B2', undefined] as const) {
      const query = filtersToQuery({ level }, 'B2');
      expect(parseFilters(query, topics, 'B2').level).toBe(level);
    }
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
