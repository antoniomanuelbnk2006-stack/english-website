import { describe, expect, it } from 'vitest';
import {
  bandCenter,
  bandStart,
  isLowConfidence,
  levelFromRating,
  nextLevel,
  progressInBand,
  summarizeRating,
} from './bands';

describe('bandas MCER', () => {
  it('cada nivel empieza 200 puntos después del anterior', () => {
    expect(bandStart('A1')).toBe(600);
    expect(bandStart('B1')).toBe(1000);
    expect(bandStart('C2')).toBe(1600);
    expect(bandCenter('B1')).toBe(1100);
    expect(bandCenter('C2')).toBe(1700);
  });

  it('asigna el nivel por rango, con los límites en el nivel superior', () => {
    expect(levelFromRating(600)).toBe('A1');
    expect(levelFromRating(799)).toBe('A1');
    expect(levelFromRating(800)).toBe('A2');
    expect(levelFromRating(999.9)).toBe('A2');
    expect(levelFromRating(1000)).toBe('B1');
    expect(levelFromRating(1199)).toBe('B1');
    expect(levelFromRating(1200)).toBe('B2');
    expect(levelFromRating(1400)).toBe('C1');
    expect(levelFromRating(1600)).toBe('C2');
  });

  it('recorta los ratings fuera de la escala', () => {
    expect(levelFromRating(300)).toBe('A1');
    expect(levelFromRating(2400)).toBe('C2');
    expect(progressInBand(300)).toBe(0);
    expect(progressInBand(2400)).toBe(1);
  });

  it('nextLevel termina en C2', () => {
    expect(nextLevel('B1')).toBe('B2');
    expect(nextLevel('C2')).toBeNull();
  });
});

describe('summarizeRating', () => {
  it('reproduce el ejemplo de la documentación: 1126 → B1 · 63 % hacia B2', () => {
    expect(summarizeRating(1126)).toEqual({ level: 'B1', next: 'B2', percent: 63 });
  });

  it('no pierde un punto por la coma flotante (1114 → 57 %, no 56 %)', () => {
    expect(summarizeRating(1114).percent).toBe(57);
    expect(summarizeRating(1058).percent).toBe(29);
  });

  it('el centro de la banda es el 50 %', () => {
    expect(summarizeRating(1100)).toEqual({ level: 'B1', next: 'B2', percent: 50 });
  });

  it('no redondea hacia arriba hasta el 100 % antes de cambiar de banda', () => {
    expect(summarizeRating(1199.9).percent).toBe(99);
    expect(summarizeRating(1200)).toEqual({ level: 'B2', next: 'C1', percent: 0 });
  });

  it('en C2 no hay nivel siguiente', () => {
    expect(summarizeRating(1650)).toEqual({ level: 'C2', next: null, percent: 25 });
  });
});

describe('isLowConfidence', () => {
  it('es baja con menos de 30 ítems', () => {
    expect(isLowConfidence(0, null)).toBe(true);
    expect(isLowConfidence(29, 1)).toBe(true);
  });

  it('es baja si el último ítem es de hace más de 21 días', () => {
    expect(isLowConfidence(120, 22)).toBe(true);
    expect(isLowConfidence(120, 21)).toBe(false);
  });

  it('es normal con datos suficientes y recientes', () => {
    expect(isLowConfidence(30, 0)).toBe(false);
  });
});
