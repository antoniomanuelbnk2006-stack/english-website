import { describe, expect, it } from 'vitest';
import type { CefrLevel } from '@/features/level/lib/bands';
import type { LexemeStatus } from '@/features/lexicon/lib/known';
import { harvest, HARVEST_LIMIT, type HarvestInput } from './harvest';

const LEVELS: Record<string, CefrLevel> = {
  trust: 'A2',
  refuse: 'B1',
  release: 'B1',
  feedback: 'B2',
  nostalgia: 'C1',
};

const glossary = [
  { lemma: 'refuse', pos: 'verb' },
  { lemma: 'modder', pos: 'noun' }, // sin nivel: técnica
  { lemma: 'keep up with', pos: 'phrasal_verb' },
  { lemma: 'release', pos: 'noun' },
  { lemma: 'nostalgia', pos: 'noun' },
  { lemma: 'trust', pos: 'verb' },
  { lemma: 'feedback', pos: 'noun' },
  { lemma: 'turn into', pos: 'phrasal_verb' },
];

const run = (extra: Partial<HarvestInput> = {}, status: Record<string, LexemeStatus> = {}) =>
  harvest({
    skill: 'reading',
    userLevel: 'B1',
    glossary,
    levelOf: (lemma) => LEVELS[lemma],
    statusOf: (lemma) => status[lemma],
    hasCard: () => false,
    ...extra,
  });

const keys = (list: ReturnType<typeof harvest>) => list.map((c) => c.key);

describe('harvest · prioridad', () => {
  it('ordena: palabras de tu nivel o el siguiente (las básicas antes), expresiones y raras', () => {
    const list = run();
    expect(list.map((c) => [c.key, c.reason])).toEqual([
      ['word:trust', 'level'],
      ['word:refuse', 'level'],
      ['word:release', 'level'],
      ['word:feedback', 'level'],
      ['chunk:keep up with', 'chunk'],
      ['chunk:turn into', 'chunk'],
      ['word:modder', 'rare'],
      ['word:nostalgia', 'rare'],
    ]);
  });

  it('las raras o técnicas se ofrecen sin marcar: basta con el glosario', () => {
    const list = run();
    expect(list.filter((c) => c.reason === 'rare').every((c) => !c.selected)).toBe(true);
    expect(list.filter((c) => c.reason !== 'rare').every((c) => c.selected)).toBe(true);
  });

  it('lo que tú consultaste o marcaste va por delante, aunque sea rara', () => {
    const list = run({ marked: new Set(['nostalgia', 'turn into']) });
    expect(list.slice(0, 2)).toEqual([
      { key: 'word:nostalgia', kind: 'word', lemma: 'nostalgia', reason: 'marked', selected: true },
      {
        key: 'chunk:turn into',
        kind: 'chunk',
        lemma: 'turn into',
        reason: 'marked',
        selected: true,
      },
    ]);
    // …y no se repite más abajo.
    expect(keys(list).filter((k) => k === 'word:nostalgia')).toHaveLength(1);
  });

  it('los fallos de dictado son lo primero: tarjeta de audio', () => {
    const list = run({
      skill: 'listening',
      failures: [
        { segmentId: 's16', cause: 'not_recognized' },
        { segmentId: 's16', cause: 'boundaries' }, // misma frase: una sola tarjeta
        { segmentId: 's28', cause: 'speed' },
      ],
    });
    expect(list.slice(0, 2)).toEqual([
      { key: 'audio:s16', kind: 'audio', segmentId: 's16', reason: 'dictation', selected: true },
      { key: 'audio:s28', kind: 'audio', segmentId: 's28', reason: 'dictation', selected: true },
    ]);
  });

  it('un fallo por palabra desconocida no da tarjeta de audio: es vocabulario', () => {
    const list = run({
      skill: 'listening',
      failures: [{ segmentId: 's5', cause: 'unknown_word' }],
    });
    expect(list.some((c) => c.kind === 'audio')).toBe(false);
  });
});

describe('harvest · qué se queda fuera', () => {
  it('lo que ya conoces, ignoras o estás aprendiendo', () => {
    const list = run(
      {},
      { refuse: 'known', release: 'ignored', trust: 'learning', feedback: 'new' },
    );
    expect(keys(list)).not.toContain('word:refuse');
    expect(keys(list)).not.toContain('word:release');
    expect(keys(list)).not.toContain('word:trust');
    expect(keys(list)).toContain('word:feedback');
  });

  it('lo que ya tiene tarjeta', () => {
    const list = run({
      skill: 'listening',
      failures: [{ segmentId: 's16', cause: 'not_recognized' }],
      hasCard: (key) => key === 'audio:s16' || key === 'chunk:turn into',
    });
    expect(keys(list)).not.toContain('audio:s16');
    expect(keys(list)).not.toContain('chunk:turn into');
  });

  it('el nivel de la entrada del glosario manda sobre el de las listas', () => {
    const list = run({ glossary: [{ lemma: 'refuse', pos: 'verb', cefr: 'C2' }] });
    expect(list).toEqual([
      { key: 'word:refuse', kind: 'word', lemma: 'refuse', reason: 'rare', selected: false },
    ]);
  });

  it('con C2 no hay nivel siguiente, pero todo sigue a tu alcance', () => {
    const list = run({ userLevel: 'C2' });
    expect(list.find((c) => c.key === 'word:nostalgia')?.reason).toBe('level');
  });
});

describe('harvest · límite por lección', () => {
  const many = Array.from({ length: 12 }, (_, i) => ({
    lemma: `word${String(i).padStart(2, '0')}`,
    pos: 'noun',
    cefr: 'B1' as const,
  }));

  it('8 tarjetas por texto; el resto queda como sugerencia sin marcar', () => {
    const list = run({ glossary: many });
    expect(list).toHaveLength(12);
    expect(list.filter((c) => c.selected)).toHaveLength(HARVEST_LIMIT.reading);
    expect(list.slice(0, 8).every((c) => c.selected)).toBe(true);
    expect(list.slice(8).every((c) => !c.selected)).toBe(true);
  });

  it('5 por lección de escucha, y los fallos de dictado entran antes que las palabras', () => {
    const list = run({
      skill: 'listening',
      glossary: many,
      failures: [
        { segmentId: 's1', cause: 'not_recognized' },
        { segmentId: 's2', cause: 'accent' },
      ],
    });
    const selected = list.filter((c) => c.selected);
    expect(selected).toHaveLength(HARVEST_LIMIT.listening);
    expect(selected.map((c) => c.kind)).toEqual(['audio', 'audio', 'word', 'word', 'word']);
  });

  it('sin nada que cosechar, la lista sale vacía', () => {
    expect(run({ glossary: [] })).toEqual([]);
  });
});
