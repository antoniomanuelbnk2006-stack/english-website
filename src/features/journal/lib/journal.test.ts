import { describe, expect, it } from 'vitest';
import { LogInput, groupByDay, splitMinutes, weekTotals, type JournalEntry } from './journal';

const entry = (
  id: number,
  loggedOn: string,
  kind: JournalEntry['kind'],
  minutes: number,
  words: number | null = null,
): JournalEntry => ({
  id,
  kind,
  source: kind.startsWith('intensive') ? 'app' : 'external',
  minutes,
  words,
  title: null,
  url: null,
  perceivedLevel: null,
  loggedOn,
});

const entries = [
  entry(1, '2026-10-04', 'extensive_listening', 40), // domingo de la semana anterior
  entry(2, '2026-10-05', 'extensive_listening', 20), // lunes
  entry(3, '2026-10-05', 'intensive_reading', 12.5, 386),
  entry(4, '2026-10-08', 'extensive_reading', 15, 2100),
  entry(5, '2026-10-08', 'intensive_listening', 14),
];

describe('LogInput', () => {
  it('acepta el registro mínimo: tipo y minutos', () => {
    expect(LogInput.parse({ kind: 'extensive_listening', minutes: 20 })).toEqual({
      kind: 'extensive_listening',
      minutes: 20,
    });
  });

  it('recorta textos y trata los vacíos como ausentes', () => {
    const parsed = LogInput.parse({
      kind: 'extensive_reading',
      minutes: 15,
      title: '  Libro graduado, cap. 3 ',
      url: '   ',
      words: 2100,
    });
    expect(parsed.title).toBe('Libro graduado, cap. 3');
    expect(parsed.url).toBeUndefined();
  });

  it('solo admite enlaces http(s)', () => {
    const base = { kind: 'extensive_listening', minutes: 10 };
    expect(
      LogInput.safeParse({ ...base, url: 'https://www.bbc.co.uk/learningenglish' }).success,
    ).toBe(true);
    expect(LogInput.safeParse({ ...base, url: 'javascript:alert(1)' }).success).toBe(false);
    expect(LogInput.safeParse({ ...base, url: 'www.bbc.co.uk' }).success).toBe(false);
  });

  it('rechaza minutos fuera de rango y tipos que solo registra la app', () => {
    expect(LogInput.safeParse({ kind: 'extensive_listening', minutes: 0 }).success).toBe(false);
    expect(LogInput.safeParse({ kind: 'extensive_listening', minutes: 601 }).success).toBe(false);
    expect(LogInput.safeParse({ kind: 'intensive_listening', minutes: 10 }).success).toBe(false);
  });
});

describe('weekTotals', () => {
  it('suma solo la semana (lunes a domingo) de la fecha dada', () => {
    expect(weekTotals(entries, '2026-10-08')).toEqual({
      listening: 34,
      reading: 27.5,
      total: 61.5,
      words: 2486,
    });
  });

  it('el domingo pertenece a la semana que acaba, no a la que empieza', () => {
    expect(weekTotals(entries, '2026-10-04').total).toBe(40);
    expect(weekTotals(entries, '2026-10-12').total).toBe(0);
  });
});

describe('groupByDay', () => {
  it('ordena los días y las entradas de más reciente a más antigua', () => {
    expect(groupByDay(entries).map((g) => [g.day, g.entries.map((e) => e.id)])).toEqual([
      ['2026-10-08', [5, 4]],
      ['2026-10-05', [3, 2]],
      ['2026-10-04', [1]],
    ]);
  });
});

describe('splitMinutes', () => {
  it('convierte minutos en horas y minutos enteros', () => {
    expect(splitMinutes(61.5)).toEqual({ h: 1, m: 2 });
    expect(splitMinutes(45)).toEqual({ h: 0, m: 45 });
    expect(splitMinutes(180)).toEqual({ h: 3, m: 0 });
  });
});
