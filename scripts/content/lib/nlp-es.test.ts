import { describe, expect, it } from 'vitest';
import { buildSpanishLexicon } from './es-lexicon';
import { languagePack, textRules } from './language-pack';
import { countSyllablesEs, fernandezHuerta, tokenizeEs, unknownWords } from './nlp-es';
import { detokenize } from './nlp';
import { PIPER_VOICES } from './tts/piper';
import { loadWordLists } from './wordlists';

// El léxico sale del mazo real (content/es/dictionary): estas pruebas también vigilan que siga
// reconociendo las formas que usan las lecciones.
const lexicon = buildSpanishLexicon();
const tokens = (text: string) => tokenizeEs(text, lexicon);
const pairs = (text: string) => tokens(text).map((token) => `${token.t}/${token.l}/${token.p}`);

describe('léxico del español', () => {
  it('genera las formas regulares de un verbo del mazo con su lema', () => {
    expect(pairs('Trabajamos y estudiamos.')).toEqual([
      'Trabajamos/trabajar/VERB',
      'y/y/CCONJ',
      'estudiamos/estudiar/VERB',
      '././PUNCT',
    ]);
  });

  it('conoce las formas irregulares y reflexivas', () => {
    expect(pairs('Voy y tengo; me acuesto y me levanto.').filter((p) => /VERB|AUX/.test(p))).toEqual([
      'Voy/ir/VERB',
      'tengo/tener/VERB',
      'acuesto/acostarse/VERB',
      'levanto/levantarse/VERB',
    ]);
    expect(pairs('Soy de Sevilla, estoy en casa.')).toContain('Soy/ser/AUX');
    expect(pairs('Soy de Sevilla, estoy en casa.')).toContain('estoy/estar/AUX');
  });

  it('pone en plural y en femenino los sustantivos y adjetivos', () => {
    const lemmas = tokens('Los compañeros, las habitaciones, mis amigas, una profesora pequeña.').map(
      (token) => token.l,
    );
    expect(lemmas).toEqual(
      expect.arrayContaining(['compañero', 'habitación', 'amigo', 'profesor', 'pequeño']),
    );
  });

  it('«como» es el verbo (yo como) o la conjunción (tan alto como tú)', () => {
    expect(pairs('Como a las dos.')[0]).toBe('Como/comer/VERB');
    expect(pairs('Es tan alto como tú.').find((p) => p.startsWith('como'))).toBe('como/como/SCONJ');
  });
});

describe('tokenizeEs', () => {
  it('reconstruye el texto, con la puntuación española', () => {
    const text = '¿Y tú? ¿De dónde eres? ¡Buen provecho!';
    expect(detokenize(tokenizeEs(text, lexicon))).toBe(text);
  });

  it('no cuenta signos, números, nombres propios ni interjecciones', () => {
    const result = tokens('Hola, Leo: tengo 24 años.');
    expect(result.filter((t) => !t.w).map((t) => t.t)).toEqual(['Hola', ',', 'Leo', ':', '24', '.']);
  });

  it('un nombre en mitad de la frase es propio; lo desconocido a principio de frase se avisa', () => {
    expect(pairs('Vivo en Zaragoza.')).toContain('Zaragoza/zaragoza/PROPN');
    expect(unknownWords(tokens('Perrito grande.'))).toEqual(['Perrito']);
    expect(unknownWords(tokens('Vivo en casa.'))).toEqual([]);
  });
});

describe('sílabas y legibilidad', () => {
  it.each([
    ['casa', 2],
    ['familia', 3],
    ['país', 2],
    ['día', 2],
    ['hermano', 3],
    ['bueno', 2],
    ['pingüino', 3],
    ['ciudad', 2],
    ['a', 1],
  ])('«%s» tiene %i sílabas', (word, count) => {
    expect(countSyllablesEs(word)).toBe(count);
  });

  it('Fernández Huerta: más fácil cuanto más cortas las palabras y las frases', () => {
    const easy = fernandezHuerta(['Me', 'llamo', 'Ana'], 1);
    const hard = fernandezHuerta(['Extraordinariamente', 'complicadísimas', 'circunstancias'], 1);
    expect(easy).toBeGreaterThan(hard);
    expect(fernandezHuerta([], 0)).toBe(0);
  });
});

describe('pack de idioma', () => {
  const english = loadWordLists();

  it('el inglés usa las listas que se le dan; el español, las del mazo', () => {
    expect(languagePack('en', english).lists).toBe(english);
    const spanish = languagePack('es', english);
    expect(spanish.lists.levels.get('casa')).toEqual({ level: 'A1', source: 'deck' });
    expect(spanish.tokenize('Mi casa es grande.').map((t) => t.l)).toContain('casa');
  });

  it('otros idiomas aún no tienen pack', () => {
    expect(() => languagePack('fr', english)).toThrow(/aún no admite/);
  });

  it('las palabras vacías son las del idioma', () => {
    expect(textRules('es').stopwords.has('porque')).toBe(true);
    expect(textRules('en').stopwords.has('about')).toBe(true);
    expect(textRules('es').stem('amigos')).toBe(textRules('es').stem('amiga'));
  });
});

describe('voces de Piper', () => {
  it('hay voz masculina y femenina de España', () => {
    expect(PIPER_VOICES['es-ES']?.female.length).toBeGreaterThan(0);
    expect(PIPER_VOICES['es-ES']?.male.length).toBeGreaterThan(0);
  });
});
