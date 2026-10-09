import { describe, expect, it } from 'vitest';
import { assess, canonicalWords } from './assess';

const heard = (...transcripts: string[]) => transcripts.map((transcript) => ({ transcript }));

describe('canonicalWords', () => {
  it('quita mayúsculas y puntuación y separa por guiones', () => {
    expect(canonicalWords('Hello, World!')).toEqual(['hello', 'world']);
    expect(canonicalWords('a T-shirt')).toEqual(['a', 't', 'shirt']);
  });

  it('escribe las cifras en letra', () => {
    expect(canonicalWords('at 7')).toEqual(['at', 'seven']);
  });

  it('despliega las contracciones para que «I am» valga por «I’m»', () => {
    expect(canonicalWords('I’m here')).toEqual(canonicalWords('I am here'));
    expect(canonicalWords("don't")).toEqual(['do', 'not']);
    expect(canonicalWords("can't")).toEqual(['can', 'not']);
    expect(canonicalWords("it's")).toEqual(canonicalWords('its'));
  });

  it('une los homófonos y las grafías americanas', () => {
    expect(canonicalWords('two')).toEqual(canonicalWords('too'));
    expect(canonicalWords('colour')).toEqual(canonicalWords('color'));
    expect(canonicalWords('colonel')).toEqual(canonicalWords('kernel'));
  });

  it('no une palabras que solo se parecen', () => {
    expect(canonicalWords('ship')).not.toEqual(canonicalWords('sheep'));
    expect(canonicalWords('price')).not.toEqual(canonicalWords('prize'));
  });
});

describe('assess: una palabra', () => {
  it('entendida a la primera es «good»', () => {
    const result = assess('ship', heard('ship'));
    expect(result).toMatchObject({ verdict: 'good', score: 1, hesitant: false, confusion: null });
    expect(result.words).toEqual([{ text: 'ship', status: 'ok' }]);
  });

  it('no importan las mayúsculas, la puntuación ni un artículo de más', () => {
    expect(assess('Spain', heard('spain.')).verdict).toBe('good');
    expect(assess('ship', heard('the ship')).verdict).toBe('good');
  });

  it('si oye otra palabra es «retry» y dice cuál', () => {
    const result = assess('ship', heard('sheep'));
    expect(result).toMatchObject({ verdict: 'retry', score: 0, heard: 'sheep' });
    expect(result.words).toEqual([{ text: 'ship', status: 'wrong', heard: 'sheep' }]);
  });

  it('si la buena no es la primera hipótesis, lo ha entendido con dudas', () => {
    const result = assess('ship', heard('sheep', 'ship'));
    expect(result).toMatchObject({ verdict: 'close', score: 1, hesitant: true, heard: 'sheep' });
  });

  it('da el consejo de la confusión típica cuando es lo que ha oído', () => {
    const confusions = [{ heard: 'sheep', tip_es: 'Hazla corta.' }];
    expect(assess('ship', heard('sheep'), confusions).confusion).toEqual(confusions[0]);
    expect(assess('ship', heard('sheep', 'ship'), confusions).confusion).toEqual(confusions[0]);
    expect(assess('ship', heard('ship'), confusions).confusion).toBeNull();
    expect(assess('ship', heard('chip'), confusions).confusion).toBeNull();
  });

  it('una vocal de más delante no cuenta como perfecto', () => {
    const confusions = [{ heard: 'a school', tip_es: 'Sin «e» delante.' }];
    const result = assess('school', heard('a school'), confusions);
    expect(result).toMatchObject({ verdict: 'close', score: 1, hesitant: false });
    expect(result.confusion).toEqual(confusions[0]);
  });

  it('sin hipótesis no hay nada que valorar', () => {
    expect(assess('ship', [])).toMatchObject({ verdict: 'retry', score: 0, heard: '' });
  });
});

describe('assess: una frase', () => {
  const target = 'I live in a big city.';

  it('entera es «good» y conserva cómo está escrita cada palabra', () => {
    const result = assess(target, heard('I live in a big city'));
    expect(result.verdict).toBe('good');
    expect(result.words.map((word) => word.text)).toEqual(['I', 'live', 'in', 'a', 'big', 'city.']);
  });

  it('marca la palabra que se oyó distinta', () => {
    const result = assess(target, heard('I leave in a big city'));
    expect(result.verdict).toBe('close');
    expect(result.score).toBeCloseTo(5 / 6);
    expect(result.words[1]).toEqual({ text: 'live', status: 'wrong', heard: 'leave' });
    expect(result.words.filter((word) => word.status === 'ok')).toHaveLength(5);
  });

  it('marca las palabras que faltan', () => {
    const result = assess(target, heard('I live in a city'));
    expect(result.words[4]).toEqual({ text: 'big', status: 'missing' });
    expect(result.verdict).toBe('close');
  });

  it('con pocas palabras entendidas es «retry»', () => {
    expect(assess(target, heard('a leaving bee')).verdict).toBe('retry');
  });

  it('se queda con la hipótesis que mejor encaja', () => {
    const result = assess(target, heard('I leave in a big city', 'I live in a big city'));
    expect(result).toMatchObject({ score: 1, hesitant: true, verdict: 'close' });
  });

  it('una contracción vale desplegada, y al revés', () => {
    expect(assess("I'd like to go.", heard('I would like to go')).verdict).toBe('good');
    expect(assess('I am here.', heard("I'm here")).verdict).toBe('good');
    const result = assess("I don't know.", heard('I know'));
    expect(result.words[1]).toEqual({ text: "don't", status: 'missing' });
  });

  it('da igual que una palabra compuesta llegue junta o separada', () => {
    expect(
      assess('She sells seashells by the seashore.', heard('she sells sea shells by the sea shore'))
        .verdict,
    ).toBe('good');
  });

  it('los homófonos no cuentan como error', () => {
    expect(
      assess(
        'How much wood would a woodchuck chuck?',
        heard('how much would wood a woodchuck chuck'),
      ).verdict,
    ).toBe('good');
  });
});
