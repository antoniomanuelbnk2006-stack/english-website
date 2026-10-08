import { describe, expect, it } from 'vitest';
import { itemDifficulty } from './item-difficulty';

const listening = { lessonDifficulty: 1095, skill: 'listening' as const };
const reading = { lessonDifficulty: 1129, skill: 'reading' as const };

describe('itemDifficulty', () => {
  it('una pregunta de detalle en la segunda escucha vale lo que la lección', () => {
    expect(itemDifficulty({ ...listening, focus: 'detail', phase: 'listen_2' })).toBe(1095);
  });

  it('la idea general es más fácil y la actitud, más difícil', () => {
    expect(itemDifficulty({ ...reading, focus: 'gist', phase: 'skim' })).toBe(1069);
    expect(itemDifficulty({ ...reading, focus: 'reference', phase: 'read' })).toBe(1149);
    expect(itemDifficulty({ ...reading, focus: 'inference', phase: 'read' })).toBe(1189);
    expect(itemDifficulty({ ...reading, focus: 'attitude_opinion', phase: 'read' })).toBe(1209);
  });

  it('en listening la primera escucha suma 40 y lo posterior al texto resta 20', () => {
    expect(itemDifficulty({ ...listening, focus: 'gist', phase: 'listen_1' })).toBe(1075);
    expect(itemDifficulty({ ...listening, focus: 'attitude_opinion', phase: 'listen_1' })).toBe(
      1215,
    );
    expect(itemDifficulty({ ...listening, focus: 'decoding', phase: 'post' })).toBe(1075);
  });

  it('la fase no ajusta nada en lectura', () => {
    expect(itemDifficulty({ ...reading, focus: 'text_structure', phase: 'post' })).toBe(1209);
  });

  it('aplica el ajuste manual de la tarea y tolera focos desconocidos', () => {
    expect(itemDifficulty({ ...reading, focus: 'detail', phase: 'read', offset: -30 })).toBe(1099);
    expect(itemDifficulty({ ...reading, focus: 'otro', phase: 'read' })).toBe(1129);
  });
});
