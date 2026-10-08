import { describe, expect, it } from 'vitest';
import { glossaryForSentence, type TextToken } from './glossary';

const tokens = (text: string, lemmas: Record<string, string> = {}): TextToken[] =>
  (text.match(/[\p{L}\p{N}']+|[^\s\p{L}\p{N}']/gu) ?? []).map((t) => ({
    t,
    l: lemmas[t] ?? t.toLowerCase(),
    sp: true,
  }));

const sentence = (id: string, text: string, lemmas: Record<string, string> = {}) => ({
  id,
  text,
  tokens: tokens(text, lemmas),
});

const glossary = [
  { lemma: 'refuse', surface: 'refuse to die', ref: 'p1s3' },
  { lemma: 'release', surface: 'release', ref: 'p1s4' },
  { lemma: 'keep up with', surface: 'keep up with', ref: 'p3s2' },
  { lemma: 'modder', surface: 'modders', ref: 'p2s1' },
];

/** `palabra → lema de su entrada`, para leer los resultados con comodidad. */
const read = (s: ReturnType<typeof sentence>) =>
  Object.fromEntries(
    [...glossaryForSentence(s, glossary)].map(([token, entry]) => [
      s.tokens[token]?.t,
      glossary[entry]?.lemma,
    ]),
  );

describe('glossaryForSentence', () => {
  it('cubre todas las palabras de la expresión en la frase a la que apunta', () => {
    expect(read(sentence('p1s3', 'But some games refuse to die.'))).toEqual({
      refuse: 'refuse',
      to: 'refuse',
      die: 'refuse',
    });
  });

  it('una expresión de varias palabras abre la misma entrada desde cualquiera de ellas', () => {
    expect(read(sentence('p3s2', "It's hard to keep up with them."))).toEqual({
      keep: 'keep up with',
      up: 'keep up with',
      with: 'keep up with',
    });
  });

  it('en otras frases, reconoce por su lema las entradas de una sola palabra', () => {
    const s = sentence('p5s1', 'The modders released a patch after the release.', {
      modders: 'modder',
      released: 'release',
    });
    expect(read(s)).toEqual({ modders: 'modder', released: 'release', release: 'release' });
  });

  it('pero no extiende una expresión fuera de su frase', () => {
    expect(read(sentence('p9s1', 'I refuse to keep up.'))).toEqual({ refuse: 'refuse' });
  });

  it('no asigna entradas a la puntuación', () => {
    const s = sentence('p1s4', 'Years after their release, they are still played.');
    const found = glossaryForSentence(s, glossary);
    expect([...found.keys()].map((i) => s.tokens[i]?.t)).toEqual(['release']);
  });

  it('funciona aunque el tokenizador parta las contracciones', () => {
    const s = {
      id: 's2',
      text: "I'll pick you up at half eleven.",
      tokens: [
        { t: 'I', l: 'i' },
        { t: "'ll", l: 'will', sp: true },
        { t: 'pick', l: 'pick', sp: true },
        { t: 'you', l: 'you', sp: true },
        { t: 'up', l: 'up', sp: true },
        { t: 'at', l: 'at', sp: true },
        { t: 'half', l: 'half', sp: true },
        { t: 'eleven', l: 'eleven' },
        { t: '.', l: '.' },
      ],
    };
    const found = glossaryForSentence(s, [{ lemma: 'pick up', surface: 'pick you up', ref: 's2' }]);
    expect([...found.keys()].map((i) => s.tokens[i]?.t)).toEqual(['pick', 'you', 'up']);
  });

  it('sin glosario no hay nada que enlazar', () => {
    expect(glossaryForSentence(sentence('p1s1', 'Hello there.'), []).size).toBe(0);
  });
});
