import { describe, expect, it } from 'vitest';
import {
  checkUoeSet,
  countExamWords,
  KeyWordTransformation,
  McqCloze,
  OpenCloze,
  toPublicSet,
  WordFormation,
} from '@/lib/content/uoe-schema';
import { expandContractions, gradeUoe, sentenceWithGap, splitCloze } from './grade';

const base = {
  version: 1,
  status: 'published',
  title: 'Sample',
  summary_es: 'Ejemplo.',
  est_minutes: 8,
  provenance: { origin: 'ai', created_at: '2026-10-09T00:00:00Z' },
} as const;

const mcq = McqCloze.parse({
  ...base,
  id: 'b2-uoe-901',
  level: 'B2',
  part: 'mcq_cloze',
  text: 'She {{1}} a decision. It {{2}} out well. He {{3}} part. They {{4}} up.',
  gaps: [
    { n: 1, options: ['did', 'made', 'had', 'put'], answer: 1, explanation_es: 'make a decision.' },
    { n: 2, options: ['turned', 'went', 'came', 'ran'], answer: 0, explanation_es: 'turn out.' },
    { n: 3, options: ['had', 'made', 'took', 'got'], answer: 2, explanation_es: 'take part.' },
    { n: 4, options: ['gave', 'let', 'set', 'took'], answer: 0, explanation_es: 'give up.' },
  ],
});

const open = OpenCloze.parse({
  ...base,
  id: 'b2-uoe-902',
  level: 'B2',
  part: 'open_cloze',
  text: 'I have lived here {{1}} 2019. {{2}} it rained, we went out. One {{3}} them. As {{4}} as.',
  gaps: [
    { n: 1, accept: ['since'], explanation_es: 'Punto de partida.' },
    { n: 2, accept: ['Although', 'Though'], explanation_es: 'Concesión.' },
    { n: 3, accept: ['of'], explanation_es: 'one of.' },
    { n: 4, accept: ['soon', 'long'], explanation_es: 'as soon as / as long as.' },
  ],
});

const formation = WordFormation.parse({
  ...base,
  id: 'b2-uoe-903',
  level: 'B2',
  part: 'word_formation',
  text: 'A very {{1}} place. Her {{2}} was clear. It was {{3}}. An {{4}} man.',
  gaps: [
    { n: 1, stem: 'ATTRACT', accept: ['attractive'], explanation_es: 'Adjetivo.' },
    { n: 2, stem: 'DISAPPOINT', accept: ['disappointment'], explanation_es: 'Nombre.' },
    { n: 3, stem: 'BELIEVE', accept: ['unbelievable'], explanation_es: 'Prefijo negativo.' },
    { n: 4, stem: 'HONEST', accept: ['dishonest'], explanation_es: 'Prefijo.' },
  ],
});

const kwt = KeyWordTransformation.parse({
  ...base,
  id: 'b2-uoe-904',
  level: 'B2',
  part: 'key_word_transformation',
  min_words: 2,
  max_words: 5,
  items: [
    {
      n: 1,
      original: 'I last saw him ten years ago.',
      keyword: 'FOR',
      before: 'I',
      after: 'ten years.',
      parts: [["haven't seen", 'have not seen'], ['him for']],
      explanation_es: 'Present perfect + for.',
    },
    {
      n: 2,
      original: 'The film was so boring that we left early.',
      keyword: 'SUCH',
      before: 'It was',
      after: 'we left early.',
      parts: [['such a boring film'], ['that']],
      explanation_es: 'such + a + adjetivo + nombre + that.',
    },
    {
      n: 3,
      original: "It wasn't necessary for you to wait.",
      keyword: 'NEED',
      before: 'You',
      after: 'waited.',
      parts: [["didn't need", 'did not need'], ['to have']],
      explanation_es: 'Necesidad en pasado.',
    },
  ],
});

describe('partes 1 a 3 · un punto por hueco', () => {
  it('parte 1: cuenta las opciones elegidas por su índice', () => {
    const result = gradeUoe(mcq, { 1: 1, 2: 0, 3: 0 });
    expect(result.items.map((item) => item.marks)).toEqual([1, 1, 0, 0]);
    expect(result).toMatchObject({ marks: 2, total: 4, score: 0.5 });
    expect(result.items[2]).toMatchObject({ given: 'had', answer: 'took', correct: false });
    // Sin responder: cero, y no se inventa una respuesta.
    expect(result.items[3]).toMatchObject({ given: '', marks: 0 });
  });

  it('parte 1: una respuesta escrita en vez de un índice no vale', () => {
    expect(gradeUoe(mcq, { 1: 'made' }).marks).toBe(0);
  });

  it('parte 2: acepta cualquiera de las variantes, sin mirar mayúsculas ni espacios', () => {
    const result = gradeUoe(open, { 1: ' SINCE ', 2: 'though', 3: 'from', 4: 'long' });
    expect(result.items.map((item) => item.correct)).toEqual([true, true, false, true]);
    expect(result.items[2]).toMatchObject({ given: 'from', answer: 'of' });
  });

  it('parte 3: la palabra tiene que estar bien escrita', () => {
    const result = gradeUoe(formation, {
      1: 'attractive',
      2: 'dissapointment',
      3: 'Unbelievable.',
      4: 'unhonest',
    });
    expect(result.items.map((item) => item.marks)).toEqual([1, 0, 1, 0]);
    expect(result.score).toBe(0.5);
  });
});

describe('parte 4 · dos puntos por frase, por mitades', () => {
  const marks = (n: number, text: string) => {
    const item = gradeUoe(kwt, { [n]: text }).items[n - 1];
    return [item?.marks, item?.note];
  };

  it('respuesta completa: 2 puntos, con o sin contracción', () => {
    expect(marks(1, "haven't seen him for")).toEqual([2, undefined]);
    expect(marks(1, 'HAVE NOT seen him for.')).toEqual([2, undefined]);
    expect(marks(2, 'such a boring film that')).toEqual([2, undefined]);
  });

  it('media respuesta: 1 punto por la mitad que está bien', () => {
    expect(marks(1, "didn't see him for")).toEqual([1, undefined]); // segunda mitad
    expect(marks(1, "haven't seen her for")).toEqual([1, undefined]); // primera mitad
    expect(marks(2, 'such boring film that')).toEqual([1, undefined]);
    expect(marks(3, "didn't need to")).toEqual([1, undefined]);
  });

  it('ninguna mitad: 0', () => {
    expect(marks(2, 'such boring films so')).toEqual([0, undefined]);
  });

  it('fuera del límite de palabras vale 0, aunque el resto esté bien', () => {
    // «haven't» cuenta como dos palabras: 6 en total.
    expect(marks(1, "haven't seen him at all for")).toEqual([0, 'word_limit']);
    expect(marks(2, 'such')).toEqual([0, 'word_limit']);
  });

  it('sin la palabra dada, o cambiándola, vale 0', () => {
    expect(marks(2, 'so boring a film that')).toEqual([0, 'keyword']);
    expect(marks(3, "didn't have to have")).toEqual([0, 'keyword']);
  });

  it('en blanco vale 0 y enseña la respuesta modelo', () => {
    const result = gradeUoe(kwt, {});
    expect(result).toMatchObject({ marks: 0, total: 6, score: 0 });
    expect(result.items[0]?.answer).toBe("haven't seen him for");
  });
});

describe('contracciones', () => {
  it('una contracción vale igual que su forma completa, en los dos sentidos', () => {
    const item = {
      ...kwt,
      items: [
        {
          n: 1,
          original: 'I regret not studying harder.',
          keyword: 'WISH',
          before: 'I',
          after: 'harder.',
          parts: [['wish I'], ['had studied']] as [string[], string[]],
          explanation_es: 'wish + past perfect.',
        },
      ],
    };
    expect(gradeUoe(item, { 1: 'wish I had studied' }).marks).toBe(2);
    expect(gradeUoe(item, { 1: "wish I'd studied" }).marks).toBe(2);
    // Y al revés: la respuesta modelo con contracción, escrita completa.
    expect(gradeUoe(kwt, { 1: 'have not seen him for' }).marks).toBe(2);
    expect(gradeUoe(kwt, { 3: 'did not need to have' }).marks).toBe(2);
  });

  it('expande cada contracción a sus lecturas posibles', () => {
    expect(expandContractions("I'd rather")).toEqual(['i had rather', 'i would rather']);
    expect(expandContractions("can't have")).toEqual(['cannot have']);
    expect(expandContractions("won't be")).toEqual(['will not be']);
    expect(expandContractions("she's gone")).toEqual(['she is gone', 'she has gone', "she's gone"]);
    expect(expandContractions('no contractions here')).toEqual(['no contractions here']);
  });
});

describe('countExamWords', () => {
  it('una contracción vale por dos palabras, salvo can’t', () => {
    expect(countExamWords("haven't seen him for")).toBe(5);
    expect(countExamWords("can't have been")).toBe(3);
    expect(countExamWords('  had   better  ')).toBe(2);
    expect(countExamWords('I’d rather you didn’t')).toBe(6);
  });
});

describe('splitCloze y sentenceWithGap', () => {
  it('parte el texto por sus huecos', () => {
    expect(splitCloze('She {{1}} a decision. It {{2}}.')).toEqual([
      'She ',
      1,
      ' a decision. It ',
      2,
      '.',
    ]);
  });

  it('saca la frase del hueco, con los demás huecos rellenos', () => {
    const text = 'I {{1}} tired. She {{2}} that it {{3}} be late! We left.';
    const fill = (n: number) => ({ 1: 'was', 2: 'said', 3: 'would' })[n] ?? '?';
    expect(sentenceWithGap(text, 3, fill)).toBe('She said that it ___ be late!');
    expect(sentenceWithGap(text, 1, fill)).toBe('I ___ tired.');
  });
});

describe('checkUoeSet', () => {
  const at = (id: string) => ({ id, level: 'b2' });

  it('los ejemplos de este fichero cumplen las reglas', () => {
    expect(checkUoeSet(mcq, at('b2-uoe-901'))).toEqual([]);
    expect(checkUoeSet(open, at('b2-uoe-902'))).toEqual([]);
    expect(checkUoeSet(formation, at('b2-uoe-903'))).toEqual([]);
    expect(checkUoeSet(kwt, at('b2-uoe-904'))).toEqual([]);
  });

  it('avisa si los huecos del texto y la lista no casan', () => {
    const broken = { ...open, text: 'Only {{1}} and {{3}} here.' };
    expect(checkUoeSet(broken, at('b2-uoe-902')).join()).toMatch(/no coinciden/);
  });

  it('avisa de una respuesta de varias palabras en la parte 2', () => {
    const broken = {
      ...open,
      gaps: open.gaps.map((gap) => (gap.n === 1 ? { ...gap, accept: ['ever since'] } : gap)),
    };
    expect(checkUoeSet(broken, at('b2-uoe-902')).join()).toMatch(/no es una sola palabra/);
  });

  it('avisa si una transformación no lleva la palabra dada o se pasa de palabras', () => {
    const broken = {
      ...kwt,
      items: kwt.items.map((item) =>
        item.n === 2
          ? {
              ...item,
              parts: [['so boring a film'], ['that all of us']] as [string[], string[]],
            }
          : item,
      ),
    };
    const issues = checkUoeSet(broken, at('b2-uoe-904')).join(' | ');
    expect(issues).toMatch(/no contiene la palabra dada SUCH/);
    expect(issues).toMatch(/tiene 8 palabras/);
  });

  it('avisa si una mitad es solo la palabra dada: ese punto se regalaría', () => {
    const broken = {
      ...kwt,
      items: kwt.items.map((item) =>
        item.n === 2
          ? { ...item, parts: [['such'], ['a boring film that']] as [string[], string[]] }
          : item,
      ),
    };
    expect(checkUoeSet(broken, at('b2-uoe-904')).join()).toMatch(/solo la palabra dada/);
  });

  it('avisa si el id o el nivel no coinciden con el fichero', () => {
    expect(checkUoeSet(mcq, { id: 'b2-uoe-001', level: 'b2' })).toHaveLength(1);
    expect(checkUoeSet(mcq, { id: 'b2-uoe-901', level: 'c1' })).toHaveLength(1);
  });
});

describe('toPublicSet · lo que ve el navegador antes de corregir', () => {
  it('no lleva respuestas ni explicaciones en ninguna parte', () => {
    for (const set of [mcq, open, formation, kwt]) {
      const sent = JSON.stringify(toPublicSet(set));
      expect(sent).not.toContain('explanation_es');
      expect(sent).not.toContain('"answer"');
      expect(sent).not.toContain('"accept"');
      expect(sent).not.toContain('"parts"');
    }
    expect(JSON.stringify(toPublicSet(formation))).toContain('ATTRACT');
    expect(JSON.stringify(toPublicSet(formation))).not.toContain('attractive');
    expect(JSON.stringify(toPublicSet(kwt))).not.toContain('him for');
  });
});
