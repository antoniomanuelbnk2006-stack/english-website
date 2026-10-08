import { describe, expect, it } from 'vitest';
import { applyExposure, type LexemeRow } from './exposure';

const row = (lemma: string, extra: Partial<LexemeRow> = {}): LexemeRow => ({
  lemma,
  status: 'new',
  seen_count: 0,
  lookup_count: 1,
  ...extra,
});

const NONE = new Set<string>();
const lesson = new Set(['release', 'refuse', 'trust']);

const run = (rows: LexemeRow[], extra: Partial<Parameters<typeof applyExposure>[1]> = {}) =>
  applyExposure(rows, {
    lessonLemmas: lesson,
    lookedUp: NONE,
    failed: NONE,
    promote: true,
    ...extra,
  });

describe('applyExposure · promoción implícita', () => {
  it('cuenta un encuentro por cada lección terminada sin consultar la palabra', () => {
    expect(run([row('release')])).toEqual([row('release', { seen_count: 1 })]);
  });

  it('al tercer encuentro seguido sin consultarla, la palabra nueva pasa a conocida', () => {
    expect(run([row('release', { seen_count: 2 })])).toEqual([
      { lemma: 'release', status: 'known', source: 'implicit', seen_count: 3, lookup_count: 1 },
    ]);
  });

  it('consultarla rompe la racha y suma una consulta', () => {
    expect(run([row('release', { seen_count: 2 })], { lookedUp: new Set(['release']) })).toEqual([
      row('release', { seen_count: 0, lookup_count: 2 }),
    ]);
  });

  it('fallarla en el dictado también rompe la racha, sin contar como consulta', () => {
    expect(run([row('release', { seen_count: 2 })], { failed: new Set(['release']) })).toEqual([
      row('release', { seen_count: 0, lookup_count: 1 }),
    ]);
  });

  it('con la promoción desactivada en ajustes, solo cuenta', () => {
    expect(run([row('release', { seen_count: 5 })], { promote: false })).toEqual([
      row('release', { seen_count: 6 }),
    ]);
  });

  it('solo promueve las «nuevas»: las que están en repaso siguen su camino en el SRS', () => {
    const rows = [
      row('release', { status: 'learning', seen_count: 2 }),
      row('refuse', { status: 'ignored', seen_count: 2 }),
      row('trust', { status: 'known', seen_count: 7 }),
    ];
    expect(run(rows).map((r) => [r.lemma, r.status, r.seen_count])).toEqual([
      ['release', 'learning', 3],
      ['refuse', 'ignored', 3],
      ['trust', 'known', 8],
    ]);
  });

  it('no toca las palabras que no salen en la lección', () => {
    expect(run([row('comet', { seen_count: 2 })])).toEqual([]);
  });
});
