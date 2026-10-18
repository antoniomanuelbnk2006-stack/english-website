import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { HelpTranslations, helpText, localize } from './help';

const Item = z.object({
  word: z.string(),
  def_es: helpText(),
  tips_es: z.array(helpText()).optional(),
  // Tiene la forma de unas traducciones, pero no es una ayuda: no se toca.
  example: z.object({ en: z.string(), es: z.string() }),
});

describe('helpText', () => {
  it('acepta una cadena, como el contenido de inglés', () => {
    const item = Item.parse({ word: 'cat', def_es: 'gato', example: { en: 'A cat.', es: 'Un gato.' } });
    expect(item.def_es).toBe('gato');
  });

  it('acepta una ayuda por idioma, con el inglés obligatorio', () => {
    const item = Item.parse({
      word: 'gato',
      def_es: { en: 'cat', fr: 'chat' },
      example: { en: 'A cat.', es: 'Un gato.' },
    });
    expect(item.def_es).toBeInstanceOf(HelpTranslations);
    expect(() =>
      Item.parse({ word: 'gato', def_es: { fr: 'chat' }, example: { en: 'x', es: 'y' } }),
    ).toThrow();
  });

  it('no admite idiomas que no son de la interfaz ni textos vacíos', () => {
    expect(() => helpText().parse({ en: 'cat', de: 'Katze' })).toThrow();
    expect(() => helpText().parse({ en: '' })).toThrow();
  });

  it('aplica las mismas reglas a cada idioma', () => {
    const short = helpText(z.string().min(1).max(5));
    expect(() => short.parse({ en: 'short', fr: 'trop long' })).toThrow();
  });

  it('se escribe como JSON igual que en los archivos', () => {
    const parsed = helpText().parse({ en: 'cat', ja: '猫' });
    expect(JSON.parse(JSON.stringify({ def_es: parsed }))).toEqual({ def_es: { en: 'cat', ja: '猫' } });
  });
});

describe('localize', () => {
  const item = Item.parse({
    word: 'gato',
    def_es: { en: 'cat', fr: 'chat', ja: '猫' },
    tips_es: [{ en: 'Masculine noun.', fr: 'Nom masculin.' }, 'Solo en español.'],
    example: { en: 'A cat.', es: 'Un gato.' },
  });

  it('elige la ayuda del idioma de la interfaz', () => {
    expect(localize(item, 'fr').def_es).toBe('chat');
    expect(localize(item, 'ja').def_es).toBe('猫');
  });

  it('si falta ese idioma, usa la de inglés', () => {
    expect(localize(item, 'zh').def_es).toBe('cat');
    expect(localize(item, 'es').def_es).toBe('cat');
  });

  it('resuelve también dentro de listas, y deja las cadenas como están', () => {
    expect(localize(item, 'fr').tips_es).toEqual(['Nom masculin.', 'Solo en español.']);
  });

  it('no toca lo que tiene forma de traducción pero no es una ayuda', () => {
    expect(localize(item, 'fr').example).toEqual({ en: 'A cat.', es: 'Un gato.' });
  });

  it('el contenido de inglés sale igual que ahora', () => {
    const english = Item.parse({ word: 'cat', def_es: 'gato', example: { en: 'A cat.', es: 'Un gato.' } });
    expect(localize(english, 'ja')).toEqual(english);
  });

  it('recuerda el resultado de cada idioma', () => {
    expect(localize(item, 'fr')).toBe(localize(item, 'fr'));
    expect(localize(item, 'fr')).not.toBe(localize(item, 'ja'));
  });
});
