import { describe, expect, it } from 'vitest';
import { fichaState, gradePractice, splitPrompt } from './practice';

const items = [
  { id: 'p1', answers: ['have never tried', "'ve never tried"], rule_es: 'Experiencia.' },
  { id: 'p2', answers: ['went'], rule_es: 'Momento terminado.' },
  { id: 'p3', answers: ['Although', 'Though'], rule_es: 'Contraste.' },
  { id: 'p4', answers: ["weren't cleaned", 'were not cleaned'], rule_es: 'Pasiva.' },
  { id: 'p5', answers: ['up'], rule_es: 'Frasal.' },
];

describe('gradePractice', () => {
  it('acepta cualquiera de las respuestas válidas, sin mirar mayúsculas ni espacios', () => {
    const { results, score } = gradePractice(
      items,
      new Map([
        ['p1', '  Have never   tried '],
        ['p2', 'WENT'],
        ['p3', 'though'],
        ['p4', 'weren’t cleaned'],
        ['p5', 'up.'],
      ]),
    );
    expect(results.map((r) => r.correct)).toEqual([true, true, true, true, true]);
    expect(score).toBe(1);
  });

  it('la forma contraída vale igual que la completa', () => {
    const { results } = gradePractice(items, new Map([['p1', "'ve never tried"]]));
    expect(results[0]?.correct).toBe(true);
  });

  it('un ítem sin responder o mal respondido cuenta como fallado', () => {
    const { results, score } = gradePractice(
      items,
      new Map([
        ['p1', 'never tried'],
        ['p2', 'went'],
        ['p3', ''],
      ]),
    );
    expect(results.map((r) => r.correct)).toEqual([false, true, false, false, false]);
    expect(score).toBe(0.2);
  });

  it('enseña la primera respuesta y la regla de cada ítem', () => {
    const { results } = gradePractice(items, new Map());
    expect(results[0]).toEqual({
      itemId: 'p1',
      correct: false,
      answer: 'have never tried',
      rule_es: 'Experiencia.',
    });
  });

  it('ignora respuestas a ítems que no existen', () => {
    const { results, score } = gradePractice(items, new Map([['p9', 'went']]));
    expect(results).toHaveLength(5);
    expect(score).toBe(0);
  });
});

describe('fichaState', () => {
  it('sin progreso es nueva; abierta sin practicar, vista', () => {
    expect(fichaState(null)).toBe('new');
    expect(fichaState(undefined)).toBe('new');
    expect(fichaState({ status: 'started', bestScore: null })).toBe('seen');
  });

  it('practicada si se ha hecho; dominada con 4 de 5 o más en el mejor intento', () => {
    expect(fichaState({ status: 'completed', bestScore: 0.6 })).toBe('practiced');
    expect(fichaState({ status: 'completed', bestScore: 0.8 })).toBe('mastered');
    expect(fichaState({ status: 'completed', bestScore: 1 })).toBe('mastered');
    expect(fichaState({ status: 'completed', bestScore: null })).toBe('practiced');
  });
});

describe('splitPrompt', () => {
  it('parte el enunciado por el hueco', () => {
    expect(splitPrompt('We ___ (go) to Lisbon last summer.')).toEqual({
      before: 'We ',
      after: ' (go) to Lisbon last summer.',
    });
    expect(splitPrompt('___ it was raining, we went out.')).toEqual({
      before: '',
      after: ' it was raining, we went out.',
    });
  });

  it('sin hueco devuelve el enunciado entero delante', () => {
    expect(splitPrompt('No gap here.')).toEqual({ before: 'No gap here.', after: '' });
  });
});
