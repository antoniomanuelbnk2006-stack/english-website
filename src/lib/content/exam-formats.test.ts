import { describe, expect, it } from 'vitest';
import {
  DELE_FORMATS,
  EXAM_FORMATS,
  EXAM_LEVELS,
  examFormat,
  paperMarks,
  paperQuestions,
  partMarks,
  speakingMarks,
  type ExamSection,
} from './exam-formats';

describe('formato oficial de los exámenes', () => {
  it('tiene las preguntas que anuncia Cambridge en cada prueba', () => {
    // Reading (y Use of English); en el A2 Key, 30 de lectura más las dos redacciones.
    expect(paperQuestions(EXAM_FORMATS.A2.reading.parts)).toBe(30);
    expect(EXAM_FORMATS.A2.reading.parts).toHaveLength(7);
    expect(paperQuestions(EXAM_FORMATS.B1.reading.parts)).toBe(32);
    expect(paperQuestions(EXAM_FORMATS.B2.reading.parts)).toBe(52);
    expect(paperQuestions(EXAM_FORMATS.C1.reading.parts)).toBe(56);
    expect(paperQuestions(EXAM_FORMATS.C2.reading.parts)).toBe(53);

    expect(paperQuestions(EXAM_FORMATS.A2.listening.parts)).toBe(25);
    expect(paperQuestions(EXAM_FORMATS.B1.listening.parts)).toBe(25);
    expect(paperQuestions(EXAM_FORMATS.B2.listening.parts)).toBe(30);
    expect(paperQuestions(EXAM_FORMATS.C1.listening.parts)).toBe(30);
    expect(paperQuestions(EXAM_FORMATS.C2.listening.parts)).toBe(30);
  });

  it('dura lo que dura el examen', () => {
    expect(EXAM_LEVELS.map((level) => EXAM_FORMATS[level].reading.minutes)).toEqual([
      60, 60, 45, 75, 90, 90,
    ]);
    expect(EXAM_LEVELS.map((level) => EXAM_FORMATS[level].listening.minutes)).toEqual([
      30, 30, 30, 40, 40, 40,
    ]);
    expect(EXAM_LEVELS.map((level) => EXAM_FORMATS[level].speaking.minutes)).toEqual([
      10, 10, 12, 14, 15, 16,
    ]);
  });

  it('los puntos de cada sección son los de la tabla de conversión de Cambridge', () => {
    for (const level of EXAM_LEVELS) {
      const format = EXAM_FORMATS[level];
      for (const paper of ['reading', 'listening'] as const) {
        const tables = Object.entries(format[paper].scale) as [
          ExamSection,
          { total: number; anchors: readonly (readonly [number, number])[] },
        ][];
        for (const [section, table] of tables) {
          const marks = format[paper].parts
            .filter((part) => part.section === section)
            .reduce((sum, part) => sum + partMarks(part), 0);
          expect(marks, `${level} ${paper} ${section}`).toBe(table.total);
        }
      }
      if (format.speaking.scale) {
        expect(speakingMarks(format), `${level} speaking`).toBe(format.speaking.scale.total);
      }
    }
    // B2 First: 42 de Reading + 28 de Use of English.
    expect(paperMarks(EXAM_FORMATS.B2.reading.parts)).toBe(70);
    expect(paperMarks(EXAM_FORMATS.C1.reading.parts)).toBe(78);
    expect(paperMarks(EXAM_FORMATS.C2.reading.parts)).toBe(72);
  });

  it('las tablas van de más a menos puntos y la nota de aprobado está en ellas', () => {
    for (const level of EXAM_LEVELS) {
      const format = EXAM_FORMATS[level];
      const tables = [
        ...Object.values(format.reading.scale),
        ...Object.values(format.listening.scale),
        ...(format.speaking.scale ? [format.speaking.scale] : []),
      ];
      if (format.pass === null) {
        expect(tables).toHaveLength(0);
        continue;
      }
      for (const table of tables) {
        const marks = table.anchors.map(([value]) => value);
        const scales = table.anchors.map(([, value]) => value);
        expect([...marks].sort((a, b) => b - a)).toEqual(marks);
        expect(scales).toContain(format.pass);
        expect(marks[0]).toBeLessThan(table.total);
      }
    }
  });

  it('el A1 no es un examen oficial y usa el formato del A2 Key', () => {
    expect(EXAM_FORMATS.A1.official).toBe(false);
    expect(EXAM_FORMATS.A1.pass).toBeNull();
    expect(EXAM_FORMATS.A1.reading.parts).toBe(EXAM_FORMATS.A2.reading.parts);
    expect(EXAM_LEVELS.filter((level) => !EXAM_FORMATS[level].official)).toEqual(['A1']);
  });
});

describe('formato del DELE (español)', () => {
  it('cada idioma tiene su examen', () => {
    expect(examFormat('B2', 'en').exam).toBe('B2 First');
    expect(examFormat('B2', 'es').exam).toBe('DELE B2');
    expect(EXAM_LEVELS.every((level) => DELE_FORMATS[level].system === 'dele')).toBe(true);
    expect(EXAM_LEVELS.every((level) => EXAM_FORMATS[level].system === 'cambridge')).toBe(true);
  });

  it('tiene los ítems de cada prueba del DELE', () => {
    expect(EXAM_LEVELS.map((level) => paperQuestions(DELE_FORMATS[level].reading.parts))).toEqual([
      25, 25, 30, 36, 40, 27,
    ]);
    expect(
      EXAM_LEVELS.map((level) => paperQuestions(DELE_FORMATS[level].listening.parts)),
    ).toEqual([25, 25, 30, 30, 30, 18]);
    expect(EXAM_LEVELS.map((level) => DELE_FORMATS[level].reading.minutes)).toEqual([
      45, 60, 70, 70, 90, 60,
    ]);
  });

  it('no tiene escala: cada prueba se aprueba con el 60 % y el oral vale 25 puntos', () => {
    for (const level of EXAM_LEVELS) {
      const format = DELE_FORMATS[level];
      expect(format.pass).toBeNull();
      expect(format.reading.scale).toEqual({});
      expect(format.listening.scale).toEqual({});
      expect(format.speaking.scale).toBeNull();
      expect(speakingMarks(format)).toBe(25);
      expect(format.writing).not.toBeNull();
    }
  });
});
