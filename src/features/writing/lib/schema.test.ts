import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { describe, expect, it } from 'vitest';
import { checkLimits, remainingToday } from './limits';
import {
  normalizeFeedback,
  overallScore,
  parseStoredFeedback,
  WritingFeedbackOutput,
} from './schema';

const TEXT = 'I am agree with you. It depends of the weather. People is friendly.';
const OPTIONS = { targetLevel: 'B2' as const };

const feedback = (over: Partial<WritingFeedbackOutput> = {}): WritingFeedbackOutput => ({
  overall_es: '  Se entiende bien.  ',
  estimated_level: 'B1',
  scores: { content: 3, communicative_achievement: 3, organisation: 2, language: 2 },
  corrections: [
    {
      original: 'I am agree',
      corrected: 'I agree',
      type: 'grammar',
      severity: 'major',
      explanation_es: '«Agree» ya es un verbo.',
      grammar_ref: '',
    },
  ],
  corrected_text: 'I agree with you. It depends of the weather. People is friendly.',
  upgrades: [{ from: 'friendly', to: 'welcoming', why_es: 'Más preciso.' }],
  focus_next_es: ' Las preposiciones. ',
  srs_candidates: [{ front: 'I am agree.', back: 'I agree — agree es verbo' }],
  ...over,
});

const normalized = (over: Partial<WritingFeedbackOutput> = {}) =>
  normalizeFeedback(feedback(over), TEXT, OPTIONS);

describe('normalizeFeedback', () => {
  it('deja las notas dentro de 0–5 y como enteros', () => {
    const result = normalized({
      scores: { content: 9, communicative_achievement: -2, organisation: 3.6, language: 5 },
    });
    expect(result.scores).toEqual({
      content: 5,
      communicative_achievement: 0,
      organisation: 4,
      language: 5,
    });
  });

  it('descarta las correcciones cuyo original no aparece literalmente en el texto', () => {
    const correction = (original: string, corrected: string) => ({
      original,
      corrected,
      type: 'grammar',
      severity: 'major',
      explanation_es: 'x',
      grammar_ref: '',
    });
    const result = normalized({
      corrections: [
        correction('I am agree', 'I agree'),
        correction('i am agree', 'I agree'), // otra caja: no es literal
        correction('depend from', 'depend on'), // inventada
        correction('People is', 'People is'), // no cambia nada
        correction('', 'x'),
      ],
    });
    expect(result.corrections.map((c) => c.original)).toEqual(['I am agree']);
  });

  it('aplica los topes: 6 correcciones, 4 mejoras y 3 tarjetas', () => {
    const many = <T>(item: T, n: number) => Array.from({ length: n }, () => item);
    const base = feedback();
    const result = normalized({
      corrections: many(base.corrections[0]!, 9),
      upgrades: many(base.upgrades[0]!, 7),
      srs_candidates: many(base.srs_candidates[0]!, 5),
    });
    expect(result.corrections).toHaveLength(6);
    expect(result.upgrades).toHaveLength(4);
    expect(result.srs_candidates).toHaveLength(3);
  });

  it('quita las referencias a fichas de gramática que no existen', () => {
    const base = feedback();
    const withRef = (ref: string) =>
      normalizeFeedback(
        feedback({ corrections: [{ ...base.corrections[0]!, grammar_ref: ref }] }),
        TEXT,
        { ...OPTIONS, grammarIds: new Set(['a1.present-simple']) },
      ).corrections[0];
    expect(withRef('a1.present-simple')).toMatchObject({ grammar_ref: 'a1.present-simple' });
    expect(withRef('b9.inventada')).toMatchObject({ grammar_ref: '' });
  });

  it('recorta los textos y descarta mejoras y tarjetas vacías', () => {
    const result = normalized({
      upgrades: [{ from: ' ', to: 'x', why_es: '' }],
      srs_candidates: [{ front: 'x', back: '  ' }],
    });
    expect(result.overall_es).toBe('Se entiende bien.');
    expect(result.focus_next_es).toBe('Las preposiciones.');
    expect(result.upgrades).toEqual([]);
    expect(result.srs_candidates).toEqual([]);
  });

  it('acepta los valores de las listas cerradas sin distinguir mayúsculas', () => {
    const base = feedback();
    const result = normalized({
      estimated_level: ' b1 ',
      corrections: [
        { ...base.corrections[0]!, type: 'False Friend', severity: 'MAJOR' },
        { ...base.corrections[0]!, original: 'depends of', type: 'estilo', severity: '?' },
      ],
    });
    expect(result.estimated_level).toBe('B1');
    expect(result.corrections.map((c) => [c.type, c.severity])).toEqual([
      ['false_friend', 'major'],
      // Lo que no se reconoce cae en el valor más prudente.
      ['grammar', 'minor'],
    ]);
    // Un nivel que no existe se sustituye por el de la consigna.
    expect(normalized({ estimated_level: 'B3' })).toMatchObject({ estimated_level: 'B2' });
  });

  it('el esquema que va a la API no lleva restricciones que esta no admite', () => {
    // Lo que el SDK envía de verdad: sin mínimos, máximos, longitudes ni listas cerradas
    // (06-ia §2.2). Si las hubiera, la petición fallaría o la respuesta no validaría.
    const format = zodOutputFormat(WritingFeedbackOutput);
    const json = JSON.stringify(format.schema);
    expect(json).not.toMatch(/"(minimum|maximum|minLength|maxLength|minItems|maxItems|enum)"/);
    expect(json).toContain('One of: grammar, vocabulary');
    // Y todo es obligatorio: la API limita los campos opcionales.
    expect(format.schema).toMatchObject({
      required: [
        'overall_es',
        'estimated_level',
        'scores',
        'corrections',
        'corrected_text',
        'upgrades',
        'focus_next_es',
        'srs_candidates',
      ],
    });
  });

  it('lo que devuelve el modelo con otra caja se valida sin romper la corrección', () => {
    const format = zodOutputFormat(WritingFeedbackOutput);
    const raw = JSON.stringify(feedback({ estimated_level: 'b2' }));
    expect(() => format.parse(raw)).not.toThrow();
  });
});

describe('parseStoredFeedback', () => {
  it('lee una corrección de la IA con la versión del prompt', () => {
    const parsed = parseStoredFeedback({ ...normalized(), prompt_version: 'writing@1' });
    expect(parsed).toMatchObject({ kind: 'ai', promptVersion: 'writing@1' });
    expect(parsed?.kind === 'ai' && parsed.feedback.corrections).toHaveLength(1);
    expect(parsed?.kind === 'ai' && 'prompt_version' in parsed.feedback).toBe(false);
  });

  it('lee una autoevaluación, con o sin notas', () => {
    expect(parseStoredFeedback({ kind: 'self', scores: null, points: [] })).toEqual({
      kind: 'self',
      scores: null,
      points: [],
    });
    const scores = { content: 4, communicative_achievement: 3, organisation: 3, language: 2 };
    expect(parseStoredFeedback({ kind: 'self', scores, points: [true, false] })).toEqual({
      kind: 'self',
      scores,
      points: [true, false],
    });
  });

  it('lo que no es feedback válido devuelve null', () => {
    expect(parseStoredFeedback(null)).toBeNull();
    expect(parseStoredFeedback({})).toBeNull();
    expect(parseStoredFeedback({ kind: 'self', scores: { content: 9 }, points: [] })).toBeNull();
    // Una corrección de IA con notas fuera de rango no se da por buena.
    const broken = {
      ...normalized(),
      scores: { content: 7, communicative_achievement: 3, organisation: 3, language: 3 },
      prompt_version: 'writing@1',
    };
    expect(parseStoredFeedback(broken)).toBeNull();
  });
});

describe('overallScore', () => {
  it('es la media de los cuatro criterios con un decimal', () => {
    expect(
      overallScore({ content: 4, communicative_achievement: 3, organisation: 3, language: 2 }),
    ).toBe(3);
    expect(
      overallScore({ content: 5, communicative_achievement: 4, organisation: 4, language: 4 }),
    ).toBe(4.3);
  });
});

describe('límites de la IA', () => {
  const usage = { usedToday: 0, dailyLimit: 10, spentMonthUsd: 0, monthlyBudgetUsd: 5 };

  it('deja pasar mientras no se llegue a ninguno de los dos', () => {
    expect(checkLimits(usage)).toBe('ok');
    expect(checkLimits({ ...usage, usedToday: 9, spentMonthUsd: 4.99 })).toBe('ok');
  });

  it('corta al llegar al límite diario', () => {
    expect(checkLimits({ ...usage, usedToday: 10 })).toBe('daily_limit');
    expect(checkLimits({ ...usage, usedToday: 11 })).toBe('daily_limit');
  });

  it('corta al llegar al tope mensual', () => {
    expect(checkLimits({ ...usage, spentMonthUsd: 5 })).toBe('monthly_budget');
    expect(checkLimits({ ...usage, spentMonthUsd: 7.5 })).toBe('monthly_budget');
  });

  it('si se cumplen los dos, manda el diario (el que se levanta antes)', () => {
    expect(checkLimits({ ...usage, usedToday: 10, spentMonthUsd: 5 })).toBe('daily_limit');
  });

  it('las correcciones que quedan nunca son negativas', () => {
    expect(remainingToday({ usedToday: 3, dailyLimit: 10 })).toBe(7);
    expect(remainingToday({ usedToday: 12, dailyLimit: 10 })).toBe(0);
  });
});
