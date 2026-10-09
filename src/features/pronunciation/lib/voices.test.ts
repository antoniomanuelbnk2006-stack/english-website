import { describe, expect, it } from 'vitest';
import { cleanFreeText, FREE_TEXT_MAX } from './free-text';
import { pickVoice } from './voices';

const voice = (name: string, lang: string) => ({ name, lang });

describe('pickVoice', () => {
  const voices = [
    voice('Microsoft Helena - Spanish (Spain)', 'es-ES'),
    voice('Microsoft Zira - English (United States)', 'en-US'),
    voice('Microsoft Hazel - English (United Kingdom)', 'en-GB'),
    voice('Microsoft Sonia Online (Natural) - English (United Kingdom)', 'en-GB'),
    voice('Google US English', 'en_US'),
  ];

  it('elige una voz del acento pedido, y neuronal si la hay', () => {
    expect(pickVoice(voices, 'en-GB')?.name).toContain('Sonia');
    expect(pickVoice(voices, 'en-US')?.name).toBe('Google US English');
  });

  it('si no hay voz de ese acento, vale otra inglesa', () => {
    expect(pickVoice([voices[0]!, voices[1]!], 'en-GB')?.lang).toBe('en-US');
  });

  it('sin voces en inglés devuelve null', () => {
    expect(pickVoice([voices[0]!], 'en-GB')).toBeNull();
    expect(pickVoice([], 'en-US')).toBeNull();
  });
});

describe('cleanFreeText', () => {
  it('deja una sola línea sin espacios de más', () => {
    expect(cleanFreeText('  How   are\nyou?  ')).toBe('How are you?');
  });

  it('quita lo que no es texto y recorta a la longitud máxima', () => {
    expect(cleanFreeText('hi\u0000<there>')).toBe('hi there');
    expect(cleanFreeText('a'.repeat(500))).toHaveLength(FREE_TEXT_MAX);
  });

  it('conserva apóstrofos y guiones', () => {
    expect(cleanFreeText("I don't like T-shirts.")).toBe("I don't like T-shirts.");
  });
});
