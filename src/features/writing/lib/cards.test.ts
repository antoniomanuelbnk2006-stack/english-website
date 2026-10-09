import { describe, expect, it } from 'vitest';
import { CardContent } from '@/features/srs/lib/cards';
import { matchesAny } from '@/features/tasks/lib/grade';
import { feedbackCards, gapOf, hintCards, MAX_WRITING_CARDS } from './cards';
import { findHints } from './checks';
import {
  criterionSeries,
  recentAverages,
  weakestCriterion,
  writingsThisWeek,
  type HistoryEntry,
} from './history';

const SOURCE = { submissionId: '11111111-1111-4111-8111-111111111111', title: 'A city break' };
const cardsFor = (text: string) => hintCards(text, findHints(text, { formal: false }), SOURCE);

describe('gapOf', () => {
  it('el hueco son solo las palabras que cambian', () => {
    expect(gapOf('depends of', 'depends on')).toEqual({
      before: 'depends ',
      answer: 'on',
      after: '',
    });
    expect(gapOf('In the other hand', 'On the other hand')).toEqual({
      before: '',
      answer: 'On',
      after: ' the other hand',
    });
    expect(gapOf('He work', 'He works')).toEqual({ before: 'He ', answer: 'works', after: '' });
  });

  it('si la propuesta solo quita algo, el hueco coge la palabra de al lado', () => {
    expect(gapOf('I am agree', 'I agree')).toEqual({ before: 'I ', answer: 'agree', after: '' });
    expect(gapOf('more better', 'better')).toEqual({ before: '', answer: 'better', after: '' });
    expect(gapOf('discussed about', 'discussed')).toEqual({
      before: '',
      answer: 'discussed',
      after: '',
    });
  });

  it('conserva el espacio inicial de la propuesta y saca la puntuación del hueco', () => {
    expect(gapOf("'ve seen", ' saw')).toEqual({ before: ' ', answer: 'saw', after: '' });
    expect(gapOf('But', 'However,')).toEqual({ before: '', answer: 'However', after: ',' });
  });

  it('no hay tarjeta si habría que escribir más de cuatro palabras', () => {
    expect(gapOf('x', 'one two three four five')).toBeNull();
    expect(gapOf('x', 'one two three four')).not.toBeNull();
  });
});

describe('hintCards', () => {
  it('hace una tarjeta de gramática con la frase corregida y un hueco', () => {
    const [candidate] = cardsFor('Hi Tom. I think it depends of the weather. See you!');
    expect(candidate).toMatchObject({ front: 'I think it depends ___ the weather.', back: 'on' });
    expect(candidate!.card).toEqual({
      kind: 'grammar',
      lemma: null,
      source_lesson_id: null,
      source_segment_id: 'wri:depend-of:on',
      front: {
        prompt: 'I think it depends ___ the weather.',
        context: 'I think it depends of the weather.',
      },
      back: {
        answers: ['on'],
        rule_es: 'Es *depend on*: *it depends on the weather*.',
        title: 'A city break',
        writing_id: SOURCE.submissionId,
      },
    });
    // La tarjeta es válida para el repaso y su respuesta se acepta al teclearla.
    expect(CardContent.safeParse(candidate!.card).success).toBe(true);
    expect(
      matchesAny('on', candidate!.card.kind === 'grammar' ? candidate!.card.back.answers : []),
    ).toBe(true);
  });

  it('en la frase de la tarjeta los demás fallos ya están corregidos', () => {
    const [first, second] = cardsFor('People is friendly and it depends of the day.');
    expect(first!.card.front).toMatchObject({
      prompt: 'People ___ friendly and it depends on the day.',
      context: 'People is friendly and it depends of the day.',
    });
    expect(second!.card.front).toMatchObject({
      prompt: 'People are friendly and it depends ___ the day.',
    });
  });

  it('enlaza con la ficha de gramática cuando la regla tiene una', () => {
    const [candidate] = cardsFor("I didn't went to school.");
    expect(candidate!.card.kind === 'grammar' && candidate!.card.back).toMatchObject({
      answers: ['go'],
      grammar_id: 'a2.past-simple',
    });
  });

  it('con la contracción, el hueco queda bien separado', () => {
    const [candidate] = cardsFor("I've seen that film yesterday.");
    expect(candidate!.card.front).toMatchObject({ prompt: 'I ___ that film yesterday.' });
    expect(candidate!.back).toBe('saw');
  });

  it('no hace tarjeta de avisos, mayúsculas ni puntuación', () => {
    expect(cardsFor('Actually i like it , really.')).toEqual([]);
  });

  it('el mismo error dos veces da una sola tarjeta, y nunca más de cinco', () => {
    expect(cardsFor('It depends of you. It depends of me.')).toHaveLength(1);
    const many =
      'It depends of you. People is nice. I am agree. She have a dog. I listen music. I did a mistake. I lost the bus.';
    expect(cardsFor(many)).toHaveLength(MAX_WRITING_CARDS);
  });
});

describe('feedbackCards', () => {
  it('convierte las tarjetas que propone la IA en tarjetas de repaso sin hueco', () => {
    const candidates = feedbackCards(
      {
        srs_candidates: [
          { front: 'I am agree with you. (fix)', back: 'I agree — «agree» es verbo' },
          { front: 'It depends ___ the weather.', back: 'on — depend on' },
        ],
      },
      SOURCE,
    );
    expect(candidates.map((c) => c.card.source_segment_id)).toEqual([
      `wri:${SOURCE.submissionId}:0`,
      `wri:${SOURCE.submissionId}:1`,
    ]);
    expect(candidates[1]!.card.front).toEqual({ prompt: 'It depends … the weather.' });
    for (const candidate of candidates) {
      expect(CardContent.safeParse(candidate.card).success).toBe(true);
      expect(candidate.card.kind === 'grammar' && candidate.card.front.prompt).not.toContain('___');
    }
  });
});

describe('historial', () => {
  const scores = (content: number, language: number) => ({
    content,
    communicative_achievement: 3,
    organisation: 3,
    language,
  });
  const entries: HistoryEntry[] = [
    { id: 'c', createdAt: '2026-10-07T18:00:00Z', kind: 'ai', scores: scores(4, 3) },
    { id: 'a', createdAt: '2026-09-28T09:00:00Z', kind: 'self', scores: scores(2, 2) },
    { id: 'b', createdAt: '2026-10-05T22:30:00Z', kind: 'ai', scores: null },
    { id: 'd', createdAt: '2026-10-08T07:00:00Z', kind: 'ai', scores: scores(4, 2) },
  ];

  it('ordena las notas de cada criterio de la más antigua a la más reciente', () => {
    const series = criterionSeries(entries);
    expect(series.content.map((point) => [point.id, point.score, point.kind])).toEqual([
      ['a', 2, 'self'],
      ['c', 4, 'ai'],
      ['d', 4, 'ai'],
    ]);
    expect(series.language.map((point) => point.score)).toEqual([2, 3, 2]);
  });

  it('el día de cada nota es el de Madrid', () => {
    const late: HistoryEntry[] = [
      { id: 'x', createdAt: '2026-10-05T22:30:00Z', kind: 'ai', scores: scores(3, 3) },
    ];
    // Las 22:30 UTC son las 00:30 del día siguiente en Madrid (horario de verano).
    expect(criterionSeries(late).content[0]!.day).toBe('2026-10-06');
  });

  it('media reciente y criterio más flojo', () => {
    expect(recentAverages(entries)).toEqual({
      content: 3.3,
      communicative_achievement: 3,
      organisation: 3,
      language: 2.3,
    });
    expect(recentAverages(entries, 2).content).toBe(4);
    expect(weakestCriterion(entries)).toBe('language');
    expect(weakestCriterion([])).toBeNull();
    expect(recentAverages([]).content).toBeNull();
  });

  it('cuenta los writings de la semana (lunes a domingo, en Madrid)', () => {
    // El 8 de octubre de 2026 es jueves: la semana va del lunes 5 al domingo 11.
    expect(writingsThisWeek(entries, '2026-10-08')).toBe(3);
    expect(writingsThisWeek(entries, '2026-09-30')).toBe(1);
    expect(writingsThisWeek(entries, '2026-10-14')).toBe(0);
  });
});
