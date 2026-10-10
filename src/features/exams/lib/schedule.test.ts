import { describe, expect, it } from 'vitest';
import type { PartFormat } from '@/lib/content/exam-formats';
import type { PublicExamPart, PublicRecording } from '@/lib/content/exam-schema';
import {
  AFTER_GAP_S,
  REPEAT_GAP_S,
  buildSchedule,
  recordingsOf,
  remainingSeconds,
  scheduleSeconds,
} from './schedule';

const recording = (id: string, duration_s: number): PublicRecording => ({
  id,
  src: `audio/exams/b2/x/v1/${id}.m4a`,
  duration_s,
});

const parts: PublicExamPart[] = [
  {
    type: 'mcq',
    rubric: 'Part 1',
    groups: [
      { recording: recording('r01', 30), questions: [{ n: 1, options: ['a', 'b', 'c'] }] },
      { recording: recording('r02', 40), questions: [{ n: 2, options: ['a', 'b', 'c'] }] },
    ],
  },
  {
    type: 'completion',
    rubric: 'Part 2',
    text: 'A {{3}}.',
    gaps: [{ n: 3 }],
    recording: recording('r03', 180),
  },
];

const formats: PartFormat[] = [
  {
    type: 'mcq',
    name: 'Multiple choice',
    questions: 2,
    marksEach: 1,
    section: 'listening',
    options: 3,
    groupPrepS: 12,
  },
  {
    type: 'completion',
    name: 'Sentence completion',
    questions: 1,
    marksEach: 1,
    section: 'listening',
    prepS: 45,
  },
];

describe('buildSchedule', () => {
  const steps = buildSchedule(parts, formats, 120);

  it('cada grabación suena dos veces, con tiempo para leer antes y una pausa después', () => {
    expect(steps.map((step) => step.kind)).toEqual([
      // Parte 1: dos extractos, cada uno con su tiempo de lectura.
      'prep',
      'play',
      'pause',
      'play',
      'pause',
      'prep',
      'play',
      'pause',
      'play',
      'pause',
      // Parte 2: un tiempo de lectura largo y la grabación dos veces.
      'prep',
      'play',
      'pause',
      'play',
      'pause',
      'review',
    ]);
    const plays = steps.flatMap((step) =>
      step.kind === 'play' ? [`${step.recording.id}:${step.pass}`] : [],
    );
    expect(plays).toEqual(['r01:1', 'r01:2', 'r02:1', 'r02:2', 'r03:1', 'r03:2']);
  });

  it('usa los tiempos de lectura del formato del examen', () => {
    expect(steps[0]).toEqual({ kind: 'prep', part: 1, seconds: 12 });
    expect(steps[10]).toEqual({ kind: 'prep', part: 2, seconds: 45 });
    expect(steps.at(-1)).toEqual({ kind: 'review', part: 2, seconds: 120 });
  });

  it('la prueba dura la suma de todo', () => {
    const audio = 2 * (30 + 40 + 180);
    const gaps = 3 * (REPEAT_GAP_S + AFTER_GAP_S);
    expect(scheduleSeconds(steps)).toBe(audio + gaps + 12 + 12 + 45 + 120);
  });

  it('calcula lo que queda desde un punto de la cinta', () => {
    const total = scheduleSeconds(steps);
    expect(remainingSeconds(steps, 0, 12)).toBe(total);
    expect(remainingSeconds(steps, steps.length - 1, 30)).toBe(30);
    expect(remainingSeconds(steps, steps.length - 1, -5)).toBe(0);
  });
});

describe('recordingsOf', () => {
  it('saca las grabaciones de cada tipo de parte, en orden', () => {
    expect(parts.flatMap(recordingsOf).map((item) => item.id)).toEqual(['r01', 'r02', 'r03']);
    expect(
      recordingsOf({
        type: 'open_cloze',
        rubric: 'x',
        title: 't',
        text: '{{1}}',
        gaps: [{ n: 1 }],
      }),
    ).toEqual([]);
  });
});
