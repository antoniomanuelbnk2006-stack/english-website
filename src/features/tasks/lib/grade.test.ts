import { describe, expect, it } from 'vitest';
import type { Task } from '@/lib/content/schema';
import { TaskResponse, grade, isAnswered, matchesAny, normalizeAnswer } from './grade';

const base = {
  focus: 'detail' as const,
  phase: 'read' as const,
  prompt: 'Question',
  evidence: ['p1s1'],
  rationale_es: 'Porque sí.',
};

const options = (...ids: string[]) => ids.map((id) => ({ id, text: `Option ${id}` }));

const mcq: Task = {
  ...base,
  id: 'q1',
  type: 'mcq',
  options: options('a', 'b', 'c', 'd'),
  answer: 'c',
};
const tfng: Task = { ...base, id: 'q2', type: 'true_false_ng', answer: 'NG', allow_ng: true };
const gaps: Task = {
  ...base,
  id: 'q3',
  type: 'gap_fill',
  text: '{{1}}, modding is not always simple. {{2}}, it is getting better.',
  gaps: [
    { n: 1, accept: ['of course'], max_words: 2 },
    { n: 2, accept: ['still', 'however', 'even so'], max_words: 2 },
  ],
};
const short: Task = {
  ...base,
  id: 'q4',
  type: 'short_answer',
  accept: ['half past eleven', '11:30', 'half eleven'],
  max_words: 3,
};
const headings: Task = {
  ...base,
  id: 'q5',
  type: 'heading_match',
  paragraphs: ['p3', 'p4', 'p5'],
  headings: options('a', 'b', 'c', 'd'),
  answers: { p3: 'a', p4: 'b', p5: 'c' },
};
const matching: Task = {
  ...base,
  id: 'q6',
  type: 'matching',
  left: options('1', '2', '3'),
  right: options('a', 'b', 'c', 'd'),
  pairs: { '1': 'b', '2': 'd', '3': 'a' },
};
const ordering: Task = {
  ...base,
  id: 'q7',
  type: 'ordering',
  items: options('a', 'b', 'c', 'd'),
  correct_order: ['c', 'a', 'd', 'b'],
};
const multi: Task = {
  ...base,
  id: 'q8',
  type: 'multi_select',
  options: options('a', 'b', 'c', 'd'),
  answers: ['a', 'c'],
};

describe('normalizeAnswer', () => {
  it('ignora mayúsculas, espacios y puntuación en los extremos', () => {
    expect(normalizeAnswer('  Of   Course. ')).toBe('of course');
    // Los teclados de móvil ponen comillas tipográficas.
    expect(normalizeAnswer('“Still,”')).toBe('still');
    expect(normalizeAnswer('(however)')).toBe('however');
  });

  it('iguala apóstrofos tipográficos y rectos sin tocar los interiores', () => {
    expect(normalizeAnswer('Don’t')).toBe("don't");
    expect(normalizeAnswer("o'clock")).toBe("o'clock");
  });

  it('matchesAny no acepta la respuesta vacía', () => {
    expect(matchesAny('', ['still'])).toBe(false);
    expect(matchesAny('  ', ['still'])).toBe(false);
    expect(matchesAny('STILL', ['still', 'however'])).toBe(true);
  });
});

describe('grade · una sola respuesta', () => {
  it('mcq: acierta solo con la opción correcta', () => {
    expect(grade(mcq, { type: 'mcq', answer: 'c' })).toMatchObject({ score: 1, correct: true });
    expect(grade(mcq, { type: 'mcq', answer: 'a' })).toMatchObject({ score: 0, correct: false });
  });

  it('true_false_ng: distingue «falso» de «no se dice»', () => {
    expect(grade(tfng, { type: 'true_false_ng', answer: 'NG' }).correct).toBe(true);
    expect(grade(tfng, { type: 'true_false_ng', answer: 'F' }).correct).toBe(false);
  });

  it('short_answer: acepta variantes y respeta el máximo de palabras', () => {
    expect(grade(short, { type: 'short_answer', text: 'Half past eleven' }).correct).toBe(true);
    expect(grade(short, { type: 'short_answer', text: ' 11:30. ' }).correct).toBe(true);
    expect(grade(short, { type: 'short_answer', text: 'at half past eleven' }).correct).toBe(false);
    expect(grade(short, { type: 'short_answer', text: 'ten thirty' }).correct).toBe(false);
  });

  it('una respuesta de otro tipo de tarea vale 0', () => {
    expect(grade(mcq, { type: 'short_answer', text: 'c' })).toMatchObject({
      score: 0,
      correct: false,
    });
  });
});

describe('grade · huecos', () => {
  it('tolera mayúsculas, espacios y variantes aceptadas', () => {
    const result = grade(gaps, {
      type: 'gap_fill',
      gaps: { '1': '  OF  course ', '2': 'However,' },
    });
    expect(result).toEqual({ score: 1, correct: true, parts: { '1': true, '2': true } });
  });

  it('da nota parcial y dice qué hueco falla', () => {
    const result = grade(gaps, { type: 'gap_fill', gaps: { '1': 'of course', '2': 'but' } });
    expect(result).toEqual({ score: 0.5, correct: false, parts: { '1': true, '2': false } });
  });

  it('un hueco vacío o con más palabras de las permitidas no vale', () => {
    expect(grade(gaps, { type: 'gap_fill', gaps: { '1': 'of course' } }).parts).toEqual({
      '1': true,
      '2': false,
    });
    expect(
      grade(gaps, { type: 'gap_fill', gaps: { '1': 'well of course', '2': 'still' } }).parts['1'],
    ).toBe(false);
  });
});

describe('grade · varias partes', () => {
  it('heading_match: fracción de párrafos bien emparejados', () => {
    const result = grade(headings, {
      type: 'heading_match',
      answers: { p3: 'a', p4: 'd', p5: 'c' },
    });
    expect(result.score).toBeCloseTo(2 / 3);
    expect(result.parts).toEqual({ p3: true, p4: false, p5: true });
  });

  it('matching: ignora los distractores sobrantes de la derecha', () => {
    expect(
      grade(matching, { type: 'matching', pairs: { '1': 'b', '2': 'd', '3': 'a' } }).correct,
    ).toBe(true);
    const partial = grade(matching, { type: 'matching', pairs: { '1': 'b', '2': 'c', '3': 'c' } });
    expect(partial.score).toBeCloseTo(1 / 3);
    expect(partial.parts).toEqual({ '1': true, '2': false, '3': false });
  });

  it('ordering: cuenta los elementos en su posición', () => {
    expect(grade(ordering, { type: 'ordering', order: ['c', 'a', 'd', 'b'] }).score).toBe(1);
    expect(grade(ordering, { type: 'ordering', order: ['c', 'a', 'b', 'd'] }).score).toBe(0.5);
    expect(grade(ordering, { type: 'ordering', order: ['a', 'c', 'b', 'd'] }).score).toBe(0);
  });

  it('multi_select: marcar de más resta y marcarlo todo no da la nota máxima', () => {
    expect(grade(multi, { type: 'multi_select', answers: ['c', 'a'] }).score).toBe(1);
    expect(grade(multi, { type: 'multi_select', answers: ['a'] }).score).toBe(0.5);
    expect(grade(multi, { type: 'multi_select', answers: ['a', 'b'] }).score).toBe(0);
    expect(grade(multi, { type: 'multi_select', answers: ['a', 'b', 'c', 'd'] }).score).toBe(0);
    expect(grade(multi, { type: 'multi_select', answers: ['a', 'b'] }).parts).toEqual({
      a: true,
      b: false,
      c: false,
      d: true,
    });
  });
});

describe('grade · dictado', () => {
  const dictation: Task = {
    ...base,
    id: 'q9',
    type: 'dictation',
    focus: 'decoding',
    phase: 'post',
    segment: 's16',
    reference: 'How many meteors are we gonna see?',
    accept_variants: [],
  };

  it('la nota es la precisión, con las equivalencias del dictado', () => {
    expect(
      grade(dictation, { type: 'dictation', text: 'how many meteors are we going to see' }),
    ).toMatchObject({
      score: 1,
      correct: true,
    });
    const partial = grade(dictation, { type: 'dictation', text: 'how many meteors we see' });
    expect(partial.score).toBeCloseTo(5 / 8, 3);
    expect(partial.correct).toBe(false);
  });

  it('no se fía de ninguna nota que venga del cliente', () => {
    const forged = { type: 'dictation', text: 'nothing', accuracy: 1 } as never;
    expect(grade(dictation, forged).score).toBe(0);
  });
});

describe('isAnswered', () => {
  it('exige una respuesta completa antes de dejar comprobar', () => {
    expect(isAnswered(mcq, undefined)).toBe(false);
    expect(isAnswered(mcq, { type: 'mcq', answer: 'a' })).toBe(true);
    expect(isAnswered(gaps, { type: 'gap_fill', gaps: { '1': 'x' } })).toBe(false);
    expect(isAnswered(gaps, { type: 'gap_fill', gaps: { '1': 'x', '2': ' y ' } })).toBe(true);
    expect(isAnswered(headings, { type: 'heading_match', answers: { p3: 'a', p4: 'b' } })).toBe(
      false,
    );
    expect(
      isAnswered(matching, { type: 'matching', pairs: { '1': 'a', '2': 'b', '3': 'c' } }),
    ).toBe(true);
    expect(isAnswered(short, { type: 'short_answer', text: '   ' })).toBe(false);
  });
});

describe('TaskResponse', () => {
  it('rechaza respuestas mal formadas o desproporcionadas', () => {
    expect(TaskResponse.safeParse({ type: 'mcq', answer: 'a' }).success).toBe(true);
    expect(TaskResponse.safeParse({ type: 'mcq' }).success).toBe(false);
    expect(TaskResponse.safeParse({ type: 'true_false_ng', answer: 'X' }).success).toBe(false);
    expect(TaskResponse.safeParse({ type: 'short_answer', text: 'a'.repeat(201) }).success).toBe(
      false,
    );
    expect(TaskResponse.safeParse({ type: 'essay', text: 'hola' }).success).toBe(false);
  });
});
