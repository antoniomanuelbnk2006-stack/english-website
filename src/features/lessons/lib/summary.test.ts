import { describe, expect, it } from 'vitest';
import { byFocus, formatClock, meanScore, toPercent } from './summary';

const tasks = [
  { id: 'q1', focus: 'gist', score: 1 },
  { id: 'q2', focus: 'gist', score: 2 / 3 },
  { id: 'q3', focus: 'detail', score: 0 },
  { id: 'q4', focus: 'inference', score: 1 },
  { id: 'q5', focus: 'detail', score: 1 },
];

describe('resumen de la lección', () => {
  it('la nota es la media, con los parciales contando su parte', () => {
    expect(meanScore(tasks)).toBeCloseTo((1 + 2 / 3 + 0 + 1 + 1) / 5);
    expect(meanScore([])).toBeNull();
  });

  it('agrupa por tipo de pregunta en orden de aparición', () => {
    expect(byFocus(tasks)).toEqual([
      { focus: 'gist', hits: 1.67, total: 2 },
      { focus: 'detail', hits: 1, total: 2 },
      { focus: 'inference', hits: 1, total: 1 },
    ]);
  });

  it('redondea el porcentaje y lo mantiene entre 0 y 100', () => {
    expect(toPercent(0.7333)).toBe(73);
    expect(toPercent(0.995)).toBe(100);
    expect(toPercent(-1)).toBe(0);
    expect(toPercent(3)).toBe(100);
  });

  it('formatea el tiempo como minutos y segundos', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(171_400)).toBe('2:51');
    expect(formatClock(3_600_000)).toBe('60:00');
  });
});
