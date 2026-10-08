import { describe, expect, it } from 'vitest';
import { parseInline } from './inline-text';

describe('parseInline', () => {
  it('separa los términos marcados con asteriscos', () => {
    expect(parseInline('*them* se refiere a los *modders*.')).toEqual([
      { text: 'them', term: true },
      { text: ' se refiere a los ', term: false },
      { text: 'modders', term: true },
      { text: '.', term: false },
    ]);
  });

  it('deja intacto el texto sin marcas', () => {
    expect(parseInline('No hay información suficiente.')).toEqual([
      { text: 'No hay información suficiente.', term: false },
    ]);
  });

  it('admite frases enteras y símbolos de enlace dentro de un término', () => {
    expect(parseInline('Enlace *pick‿you‿up‿at* y la expresión *half eleven*.')).toEqual([
      { text: 'Enlace ', term: false },
      { text: 'pick‿you‿up‿at', term: true },
      { text: ' y la expresión ', term: false },
      { text: 'half eleven', term: true },
      { text: '.', term: false },
    ]);
  });

  it('un asterisco suelto no es una marca', () => {
    expect(parseInline('5 * 3 = 15')).toEqual([{ text: '5 * 3 = 15', term: false }]);
    expect(parseInline('**')).toEqual([{ text: '**', term: false }]);
  });
});
