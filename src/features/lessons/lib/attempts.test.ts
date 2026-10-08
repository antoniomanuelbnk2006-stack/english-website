import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PublishedReading } from '@/lib/content/schema';
import { SubmitAttemptsInput, lessonScore, prepareAttempts } from './attempts';

const lesson = PublishedReading.parse(
  JSON.parse(
    readFileSync(
      path.join(process.cwd(), 'content', 'lessons', 'b1', 'reading', 'b1-rea-001.json'),
      'utf8',
    ),
  ),
);

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('prepareAttempts', () => {
  it('corrige en el servidor y calcula la dificultad de cada ítem', () => {
    const { rows, unknownItems } = prepareAttempts(
      lesson,
      [
        {
          itemId: 'q1',
          response: { type: 'mcq', answer: 'b' },
          clientId: uuid(1),
          durationMs: 9000,
        },
        { itemId: 'q4', response: { type: 'mcq', answer: 'a' }, clientId: uuid(2) },
        { itemId: 'q9', response: { type: 'mcq', answer: 'a' }, clientId: uuid(3) },
      ],
      1100,
    );

    expect(unknownItems).toEqual([]);
    expect(rows.map((r) => [r.item_id, r.focus, r.phase, r.score, r.item_difficulty])).toEqual([
      ['b1-rea-001:q1', 'gist', 'skim', 1, lesson.difficulty - 60],
      ['b1-rea-001:q4', 'reference', 'read', 0, lesson.difficulty + 20],
      ['b1-rea-001:q9', 'attitude_opinion', 'read', 1, lesson.difficulty + 80],
    ]);
    expect(rows[0]).toMatchObject({
      skill: 'reading',
      task_type: 'mcq',
      rating_before: 1100,
      duration_ms: 9000,
      client_id: uuid(1),
      created_at: null,
    });
  });

  it('da nota parcial en tareas con varias partes', () => {
    const { rows } = prepareAttempts(
      lesson,
      [
        {
          itemId: 'q2',
          response: { type: 'heading_match', answers: { p3: 'a', p4: 'b', p5: 'd' } },
          clientId: uuid(1),
        },
        {
          itemId: 'q11',
          response: { type: 'gap_fill', gaps: { '1': 'Of course', '2': 'but' } },
          clientId: uuid(2),
        },
      ],
      1100,
    );
    expect(rows[0]?.score).toBeCloseTo(2 / 3);
    expect(rows[1]?.score).toBe(0.5);
  });

  it('una respuesta del tipo equivocado puntúa 0 en vez de romper', () => {
    const { rows } = prepareAttempts(
      lesson,
      [{ itemId: 'q1', response: { type: 'short_answer', text: 'b' }, clientId: uuid(1) }],
      1100,
    );
    expect(rows[0]?.score).toBe(0);
  });

  it('separa las tareas que no existen en la lección', () => {
    const { rows, unknownItems } = prepareAttempts(
      lesson,
      [
        { itemId: 'q1', response: { type: 'mcq', answer: 'b' }, clientId: uuid(1) },
        { itemId: 'q99', response: { type: 'mcq', answer: 'a' }, clientId: uuid(2) },
      ],
      1100,
    );
    expect(rows).toHaveLength(1);
    expect(unknownItems).toEqual(['q99']);
  });
});

describe('lessonScore', () => {
  it('es la media de la última respuesta a cada tarea', () => {
    expect(
      lessonScore([
        { itemId: 'q1', score: 0 },
        { itemId: 'q2', score: 1 },
        { itemId: 'q1', score: 1 },
        { itemId: 'q3', score: 0.5 },
      ]),
    ).toBeCloseTo(0.8333, 4);
  });

  it('no hay nota sin respuestas', () => {
    expect(lessonScore([])).toBeNull();
  });
});

describe('SubmitAttemptsInput', () => {
  const valid = {
    lessonId: 'b1-rea-001',
    lessonVersion: 1,
    attempts: [{ itemId: 'q1', response: { type: 'mcq', answer: 'b' }, clientId: uuid(1) }],
    progress: { phase: 3, completed: false, activeSeconds: 120 },
  };

  it('acepta un envío normal', () => {
    expect(SubmitAttemptsInput.safeParse(valid).success).toBe(true);
  });

  it('rechaza ids mal formados, clientId que no es UUID y tiempos absurdos', () => {
    expect(SubmitAttemptsInput.safeParse({ ...valid, lessonId: '../../etc/passwd' }).success).toBe(
      false,
    );
    expect(
      SubmitAttemptsInput.safeParse({
        ...valid,
        attempts: [{ ...valid.attempts[0], clientId: 'abc' }],
      }).success,
    ).toBe(false);
    expect(
      SubmitAttemptsInput.safeParse({
        ...valid,
        progress: { ...valid.progress, activeSeconds: 999_999 },
      }).success,
    ).toBe(false);
    expect(
      SubmitAttemptsInput.safeParse({ ...valid, progress: { ...valid.progress, readingWpm: 5000 } })
        .success,
    ).toBe(false);
  });
});
