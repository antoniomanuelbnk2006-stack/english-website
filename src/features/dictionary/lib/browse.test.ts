import { describe, expect, it } from 'vitest';
import type { LexemeStatus } from '@/features/lexicon/lib/known';
import type { DictionaryEntry } from '@/lib/content/dictionary-schema';
import {
  filterEntries,
  fold,
  matchesQuery,
  paginate,
  parseBrowseParams,
  pickStudyBatch,
  stateOf,
  summarize,
  toQuery,
} from './browse';

const entry = (lemma: string, translation: string, rank?: number): DictionaryEntry => ({
  lemma,
  pos: ['noun'],
  translation,
  example: `This is ${lemma}.`,
  surface: lemma,
  ...(rank ? { rank } : {}),
});

const entries = [
  entry('accommodation', 'alojamiento', 2400),
  entry('acid', 'ácido'),
  entry('April', 'abril', 900),
  entry('carbon dioxide', 'dióxido de carbono'),
  entry('action', 'acción; acto', 300),
];

const statuses = new Map<string, LexemeStatus>([
  ['acid', 'known'],
  ['april', 'learning'],
  ['action', 'new'],
  ['carbon dioxide', 'ignored'],
]);

describe('stateOf', () => {
  it('sin fila o «nueva» es «por aprender»; el resto se conserva', () => {
    expect(stateOf(undefined)).toBe('todo');
    expect(stateOf('new')).toBe('todo');
    expect(stateOf('learning')).toBe('learning');
    expect(stateOf('known')).toBe('known');
    expect(stateOf('ignored')).toBe('ignored');
  });
});

describe('parseBrowseParams / toQuery', () => {
  it('sin parámetros usa el nivel del usuario, todas y la primera página', () => {
    expect(parseBrowseParams({}, 'B2')).toEqual({ level: 'B2', query: '', state: 'all', page: 1 });
  });

  it('lee nivel, búsqueda, estado y página, y descarta lo que no vale', () => {
    expect(
      parseBrowseParams({ nivel: 'C1', q: '  Acid ', estado: 'known', pagina: '3' }, 'B2'),
    ).toEqual({ level: 'C1', query: 'Acid', state: 'known', page: 3 });
    expect(parseBrowseParams({ nivel: 'Z9', estado: 'x', pagina: '-2' }, 'A2')).toEqual({
      level: 'A2',
      query: '',
      state: 'all',
      page: 1,
    });
    expect(parseBrowseParams({ nivel: ['B1', 'C2'], pagina: 'abc' }, 'A2').level).toBe('B1');
  });

  it('en los enlaces solo va lo que no es el valor por defecto', () => {
    expect(toQuery({ level: 'B2', query: '', state: 'all', page: 1 }, 'B2')).toEqual({});
    expect(toQuery({ level: 'C1', query: 'acid', state: 'todo', page: 2 }, 'B2')).toEqual({
      nivel: 'C1',
      q: 'acid',
      estado: 'todo',
      pagina: '2',
    });
  });
});

describe('matchesQuery', () => {
  it('busca por el principio de la palabra en inglés', () => {
    expect(matchesQuery(entries[0]!, 'acc')).toBe(true);
    expect(matchesQuery(entries[0]!, 'modation')).toBe(false);
    expect(matchesQuery(entries[2]!, 'apr')).toBe(true);
  });

  it('busca por el principio de cualquier palabra de la traducción, sin tildes', () => {
    expect(fold('Acción')).toBe('accion');
    expect(matchesQuery(entries[4]!, 'accion')).toBe(true);
    expect(matchesQuery(entries[4]!, 'acto')).toBe(true);
    expect(matchesQuery(entries[3]!, 'carbono')).toBe(true);
    expect(matchesQuery(entries[3]!, 'oxido')).toBe(false);
  });

  it('una búsqueda vacía lo acepta todo', () => {
    expect(matchesQuery(entries[1]!, '  ')).toBe(true);
  });
});

describe('filterEntries', () => {
  it('filtra por estado', () => {
    const lemmas = (state: 'all' | 'todo' | 'learning' | 'known') =>
      filterEntries(entries, statuses, { query: '', state }).map((item) => item.lemma);
    expect(lemmas('all')).toHaveLength(5);
    expect(lemmas('todo')).toEqual(['accommodation', 'action']);
    expect(lemmas('learning')).toEqual(['April']);
    expect(lemmas('known')).toEqual(['acid']);
  });

  it('combina búsqueda y estado', () => {
    expect(
      filterEntries(entries, statuses, { query: 'ac', state: 'todo' }).map((item) => item.lemma),
    ).toEqual(['accommodation', 'action']);
  });
});

describe('paginate', () => {
  const items = Array.from({ length: 95 }, (_, index) => index);

  it('parte en páginas', () => {
    expect(paginate(items, 1, 40)).toMatchObject({ page: 1, pages: 3, total: 95 });
    expect(paginate(items, 3, 40).items).toHaveLength(15);
  });

  it('una página fuera de rango se lleva a la última, y una lista vacía tiene una página', () => {
    expect(paginate(items, 99, 40).page).toBe(3);
    expect(paginate([], 4, 40)).toEqual({ items: [], page: 1, pages: 1, total: 0 });
  });
});

describe('summarize', () => {
  it('cuenta conocidas, en repaso y por aprender; las ignoradas no entran en ninguna', () => {
    expect(summarize(entries, statuses)).toEqual({ total: 5, known: 1, learning: 1, todo: 2 });
  });
});

describe('pickStudyBatch', () => {
  it('solo ofrece lo que queda por aprender, primero lo más frecuente', () => {
    expect(pickStudyBatch(entries, statuses).map((item) => item.lemma)).toEqual([
      'action',
      'accommodation',
    ]);
  });

  it('sin frecuencia, por orden alfabético y con tope', () => {
    const batch = pickStudyBatch(entries, new Map(), 3).map((item) => item.lemma);
    expect(batch).toEqual(['action', 'April', 'accommodation']);
    expect(
      pickStudyBatch(entries, new Map(), 10)
        .slice(3)
        .map((item) => item.lemma),
    ).toEqual(['acid', 'carbon dioxide']);
  });
});
