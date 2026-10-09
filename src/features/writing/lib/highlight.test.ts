import { describe, expect, it } from 'vitest';
import { locate, segment } from './highlight';

describe('locate', () => {
  it('encuentra cada fragmento en el texto', () => {
    expect(locate('I am agree. It depends of you.', ['I am agree', 'depends of'])).toEqual([
      { start: 0, end: 10 },
      { start: 15, end: 25 },
    ]);
  });

  it('dos correcciones iguales señalan apariciones distintas', () => {
    expect(locate('more better and more better', ['more better', 'more better'])).toEqual([
      { start: 0, end: 11 },
      { start: 16, end: 27 },
    ]);
  });

  it('devuelve null si no está, si está vacío o si ya no queda sitio libre', () => {
    expect(locate('one two', ['three', '', 'one', 'one'])).toEqual([
      null,
      null,
      { start: 0, end: 3 },
      null,
    ]);
  });

  it('un fragmento que pisa a otro busca su siguiente aparición', () => {
    expect(locate('the cat and the dog', ['the cat', 'the'])).toEqual([
      { start: 0, end: 7 },
      { start: 12, end: 15 },
    ]);
  });
});

describe('segment', () => {
  it('parte el texto en trozos normales y resaltados, en orden', () => {
    const text = 'I am agree. It depends of you.';
    const pieces = segment(text, locate(text, ['depends of', 'I am agree']));
    expect(pieces).toEqual([
      { text: 'I am agree', index: 1 },
      { text: '. It ', index: null },
      { text: 'depends of', index: 0 },
      { text: ' you.', index: null },
    ]);
    expect(pieces.map((piece) => piece.text).join('')).toBe(text);
  });

  it('sin tramos devuelve el texto entero; con texto vacío, nada', () => {
    expect(segment('Hello.', [])).toEqual([{ text: 'Hello.', index: null }]);
    expect(segment('Hello.', [null])).toEqual([{ text: 'Hello.', index: null }]);
    expect(segment('', [])).toEqual([]);
  });

  it('ignora los tramos que se pisan o se salen del texto', () => {
    const pieces = segment('abcdef', [
      { start: 0, end: 3 },
      { start: 2, end: 4 },
      { start: 4, end: 99 },
    ]);
    expect(pieces).toEqual([
      { text: 'abc', index: 0 },
      { text: 'def', index: null },
    ]);
  });
});
