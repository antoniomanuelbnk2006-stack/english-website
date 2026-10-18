import { describe, expect, it } from 'vitest';
import { UoeSet } from './uoe-schema';

const base = {
  version: 1,
  status: 'published',
  level: 'B2',
  title: 'Prueba',
  summary_es: 'Prueba',
  est_minutes: 5,
  provenance: { origin: 'ai', created_at: '2026-10-19T00:00:00Z' },
};

const formation = (stem: string) => ({
  ...base,
  id: 'es-b2-uoe-001',
  part: 'word_formation',
  text: '{{1}} {{2}} {{3}} {{4}}',
  gaps: [1, 2, 3, 4].map((n) => ({ n, stem, accept: ['respuesta'], explanation_es: 'x' })),
});

describe('UoeSet en español', () => {
  it('acepta palabras dadas con tilde y con ñ', () => {
    expect(UoeSet.safeParse(formation('CANCIÓN')).success).toBe(true);
    expect(UoeSet.safeParse(formation('DISEÑO')).success).toBe(true);
  });

  it('la palabra dada sigue siendo en mayúsculas', () => {
    expect(UoeSet.safeParse(formation('canción')).success).toBe(false);
  });

  it('la palabra clave de una transformación puede llevar tilde', () => {
    const set = {
      ...base,
      id: 'es-b2-uoe-002',
      part: 'key_word_transformation',
      min_words: 2,
      max_words: 5,
      items: [1, 2, 3].map((n) => ({
        n,
        original: 'Probablemente lloverá.',
        keyword: 'SEGÚN',
        before: '',
        after: 'llueva.',
        parts: [['Es probable'], ['que']],
        explanation_es: 'x',
      })),
    };
    expect(UoeSet.safeParse(set).success).toBe(true);
  });
});
