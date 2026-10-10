import { describe, expect, it } from 'vitest';
import { EXAM_FORMATS } from '@/lib/content/exam-formats';
import { isPass, scaleBand, toScale } from './scale';

const reading = EXAM_FORMATS.B2.reading.scale.reading!;
const useOfEnglish = EXAM_FORMATS.B2.reading.scale.use_of_english!;

describe('toScale', () => {
  it('da la nota de la tabla de Cambridge en sus puntos de referencia', () => {
    // B2 First, Reading (42 puntos): 37 → 180, 24 → 160, 16 → 140, 10 → 122.
    expect(toScale(reading, 37, 160)).toBe(180);
    expect(toScale(reading, 24, 160)).toBe(160);
    expect(toScale(reading, 16, 140 + 20)).toBe(140);
    expect(toScale(reading, 10, 160)).toBe(122);
    expect(toScale(useOfEnglish, 18, 160)).toBe(160);
  });

  it('interpola entre dos puntos de referencia', () => {
    // De 24 (160) a 37 (180): 13 puntos para 20 de escala.
    expect(toScale(reading, 30, 160)).toBe(169);
    expect(toScale(reading, 25, 160)).toBe(162);
    // De 16 (140) a 24 (160).
    expect(toScale(reading, 20, 160)).toBe(150);
  });

  it('la nota máxima del examen está 30 puntos por encima del aprobado', () => {
    expect(toScale(reading, 42, 160)).toBe(190);
    expect(toScale(reading, 40, 160)).toBe(186);
    expect(toScale(EXAM_FORMATS.C2.listening.scale.listening!, 30, 200)).toBe(230);
  });

  it('por debajo de la nota mínima que informa el examen no hay nota', () => {
    expect(toScale(reading, 9, 160)).toBeNull();
    expect(toScale(reading, 0, 160)).toBeNull();
  });

  it('nunca baja cuando suben los puntos', () => {
    for (const format of Object.values(EXAM_FORMATS)) {
      if (format.pass === null) continue;
      const tables = [
        ...Object.values(format.reading.scale),
        ...Object.values(format.listening.scale),
        ...(format.speaking.scale ? [format.speaking.scale] : []),
      ];
      for (const table of tables) {
        let previous = -1;
        for (let marks = 0; marks <= table.total; marks++) {
          const scale = toScale(table, marks, format.pass) ?? 0;
          expect(scale).toBeGreaterThanOrEqual(previous);
          previous = scale;
        }
      }
    }
  });
});

describe('scaleBand', () => {
  it('reparte las notas del B2 First como su certificado', () => {
    expect(scaleBand(185, 160)).toBe('grade_a');
    expect(scaleBand(180, 160)).toBe('grade_a');
    expect(scaleBand(179, 160)).toBe('grade_b');
    expect(scaleBand(173, 160)).toBe('grade_b');
    expect(scaleBand(172, 160)).toBe('grade_c');
    expect(scaleBand(160, 160)).toBe('grade_c');
    expect(scaleBand(159, 160)).toBe('level_below');
    expect(scaleBand(140, 160)).toBe('level_below');
    expect(scaleBand(139, 160)).toBe('below');
    expect(scaleBand(null, 160)).toBe('below');
  });

  it('solo las tres notas con Grade son un aprobado', () => {
    expect(isPass('grade_a')).toBe(true);
    expect(isPass('grade_c')).toBe(true);
    expect(isPass('level_below')).toBe(false);
    expect(isPass('below')).toBe(false);
  });
});
