import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, parseSettings } from './settings';

describe('parseSettings', () => {
  it('un perfil recién creado (jsonb vacío) toma los valores por defecto', () => {
    expect(parseSettings({})).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('roto')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings([1, 2])).toEqual(DEFAULT_SETTINGS);
  });

  it('respeta los valores válidos', () => {
    expect(
      parseSettings({
        theme: 'light',
        reading_font_px: 22,
        reader_paper: true,
        playback_rate: 0.85,
      }),
    ).toEqual({
      ...DEFAULT_SETTINGS,
      theme: 'light',
      reading_font_px: 22,
      reader_paper: true,
      playback_rate: 0.85,
    });
  });

  it('sustituye solo el campo que no vale y conserva el resto', () => {
    const parsed = parseSettings({
      theme: 'neon',
      reading_font_px: 40,
      playback_rate: 3,
      reader_paper: true,
    });
    expect(parsed.theme).toBe('dark');
    expect(parsed.reading_font_px).toBe(19);
    expect(parsed.playback_rate).toBe(1);
    expect(parsed.reader_paper).toBe(true);
  });

  it('el idioma que se practica empieza en inglés y no admite uno que no exista', () => {
    expect(DEFAULT_SETTINGS.practice_language).toBe('en');
    expect(parseSettings({ practice_language: 'es' }).practice_language).toBe('es');
    expect(parseSettings({ practice_language: 'klingon' }).practice_language).toBe('en');
  });

  it('ignora claves desconocidas (p. ej. fsrs_params se guarda aparte)', () => {
    expect(parseSettings({ fsrs_params: [1, 2, 3] })).toEqual(DEFAULT_SETTINGS);
  });
});
