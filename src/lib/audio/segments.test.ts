import { describe, expect, it } from 'vitest';
import { audioUrl, clampRate, segmentAt, wordAt } from './segments';

const segments = [
  { start: 0, end: 2.1 },
  { start: 2.5, end: 4 },
  { start: 4.4, end: 7.3 },
];

describe('segmentAt', () => {
  it('devuelve el segmento que suena', () => {
    expect(segmentAt(segments, 0)).toBe(0);
    expect(segmentAt(segments, 1.9)).toBe(0);
    expect(segmentAt(segments, 2.5)).toBe(1);
    expect(segmentAt(segments, 6)).toBe(2);
  });

  it('en una pausa se queda en el anterior y al final, en el último', () => {
    expect(segmentAt(segments, 2.3)).toBe(0);
    expect(segmentAt(segments, 4.2)).toBe(1);
    expect(segmentAt(segments, 99)).toBe(2);
  });

  it('no falla con tiempos negativos ni sin segmentos', () => {
    expect(segmentAt(segments, -1)).toBe(0);
    expect(segmentAt([], 3)).toBe(0);
  });
});

describe('wordAt', () => {
  const starts = [0.1, 0.4, 0.9, 1.5];

  it('devuelve la última palabra que ya ha empezado', () => {
    expect(wordAt(starts, 0.05)).toBe(-1);
    expect(wordAt(starts, 0.1)).toBe(0);
    expect(wordAt(starts, 0.89)).toBe(1);
    expect(wordAt(starts, 1.5)).toBe(3);
    expect(wordAt(starts, 60)).toBe(3);
    expect(wordAt([], 1)).toBe(-1);
  });
});

describe('clampRate', () => {
  it('se mantiene entre 0,5 y 1,5 en pasos de 0,05', () => {
    expect(clampRate(1)).toBe(1);
    expect(clampRate(0.93)).toBe(0.95);
    expect(clampRate(0.1)).toBe(0.5);
    expect(clampRate(3)).toBe(1.5);
  });

  it('no acumula error de coma flotante al subir y bajar', () => {
    let rate = 1;
    for (let i = 0; i < 7; i++) rate = clampRate(rate + 0.05);
    expect(rate).toBe(1.35);
    for (let i = 0; i < 14; i++) rate = clampRate(rate - 0.05);
    expect(rate).toBe(0.65);
  });
});

describe('audioUrl', () => {
  it('une la base y la ruta sin barras duplicadas', () => {
    expect(audioUrl('https://audio.example.dev/', '/audio/b1/x/v1.m4a')).toBe(
      'https://audio.example.dev/audio/b1/x/v1.m4a',
    );
    expect(audioUrl('/dev-audio', 'audio/b1/x/v1.m4a')).toBe('/dev-audio/audio/b1/x/v1.m4a');
  });
});
