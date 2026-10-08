import { describe, expect, it } from 'vitest';
import { coverage, isKnown, knownLemmas, type LexemeStatus } from './known';

describe('isKnown', () => {
  it('lo que diga el léxico personal manda sobre el nivel', () => {
    expect(isKnown({ status: 'known', level: 'C2', userLevel: 'B1' })).toBe(true);
    expect(isKnown({ status: 'learning', level: 'A1', userLevel: 'B1' })).toBe(false);
    expect(isKnown({ status: 'new', level: 'A1', userLevel: 'B1' })).toBe(false);
  });

  it('las palabras ignoradas no cuentan como desconocidas', () => {
    expect(isKnown({ status: 'ignored', userLevel: 'B1' })).toBe(true);
  });

  it('las palabras gramaticales se conocen desde A1', () => {
    expect(isKnown({ pos: 'ADP', userLevel: 'A1' })).toBe(true);
    expect(isKnown({ pos: 'AUX', level: 'B2', userLevel: 'A1' })).toBe(true);
  });

  it('sin entrada en el léxico, se conoce lo que no supera el nivel del usuario', () => {
    expect(isKnown({ pos: 'NOUN', level: 'A2', userLevel: 'B1' })).toBe(true);
    expect(isKnown({ pos: 'NOUN', level: 'B1', userLevel: 'B1' })).toBe(true);
    expect(isKnown({ pos: 'NOUN', level: 'B2', userLevel: 'B1' })).toBe(false);
  });

  it('una palabra que no está en ninguna lista se trata como desconocida', () => {
    expect(isKnown({ pos: 'NOUN', userLevel: 'C2' })).toBe(false);
  });
});

const tokens = [
  { l: 'the', p: 'DET', w: true },
  { l: 'forecast', p: 'NOUN', w: true },
  { l: 'say', p: 'VERB', w: true },
  { l: 'telescope', p: 'NOUN', w: true },
  { l: 'leo', p: 'PROPN', w: false },
  { l: 'modder', p: 'NOUN', w: true },
  { l: 'the', p: 'DET', w: true },
  { l: '.', p: 'PUNCT', w: false },
];
const levels: Record<string, 'A1' | 'B1' | 'B2'> = { forecast: 'B1', say: 'A1', telescope: 'B2' };

describe('knownLemmas y coverage', () => {
  const context = (status: Record<string, LexemeStatus> = {}) => ({
    statusOf: (lemma: string) => status[lemma],
    levelOf: (lemma: string) => levels[lemma],
    userLevel: 'B1' as const,
  });

  it('parte del nivel del usuario e ignora lo que no cuenta', () => {
    expect([...knownLemmas(tokens, context())].sort()).toEqual(['forecast', 'say', 'the']);
  });

  it('el léxico personal añade y quita palabras', () => {
    const known = knownLemmas(tokens, context({ telescope: 'known', forecast: 'learning' }));
    expect([...known].sort()).toEqual(['say', 'telescope', 'the']);
  });

  it('la cobertura es tokens contables conocidos / tokens contables', () => {
    // Contables: the, forecast, say, telescope, modder, the → 6; conocidos: the ×2, forecast, say → 4.
    expect(coverage(tokens, knownLemmas(tokens, context()))).toBeCloseTo(4 / 6);
    expect(coverage(tokens, new Set())).toBeCloseTo(2 / 6); // solo las gramaticales
    expect(coverage([], new Set())).toBe(1);
  });

  it('con tokens ya agrupados por lema, cada uno pesa las veces que aparece', () => {
    const grouped = [
      { l: 'game', p: 'NOUN', w: true, n: 8 },
      { l: 'modder', p: 'NOUN', w: true, n: 2 },
      { l: 'the', p: 'DET', w: true, n: 10 },
      { l: ',', p: 'PUNCT', w: false, n: 30 },
    ];
    // 20 contables: «the» (10, gramatical) y «game» (8) conocidos → 18 / 20.
    expect(coverage(grouped, new Set(['game']))).toBeCloseTo(0.9);
    // Da lo mismo que contar los tokens uno a uno.
    const flat = grouped.flatMap(({ n, ...token }) => Array.from({ length: n }, () => token));
    expect(coverage(flat, new Set(['game']))).toBeCloseTo(0.9);
  });
});
