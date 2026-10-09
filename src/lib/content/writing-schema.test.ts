import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { reviewText } from '@/features/writing/lib/checks';
import {
  checkWritingPrompt,
  countWords,
  splitParagraphs,
  toPublicPrompt,
  WRITING_TYPES_BY_LEVEL,
  WRITING_WORDS,
  WritingPrompt,
} from './writing-schema';

const ROOT = path.join(process.cwd(), 'content', 'writing');

const prompt = (over: Partial<WritingPrompt> = {}): WritingPrompt => ({
  id: 'b1-wri-900',
  version: 1,
  status: 'published',
  level: 'B1',
  task_type: 'email',
  title: 'A test email',
  topic: 'travel',
  context_es: 'Escribes a una amiga.',
  prompt_en: 'Write an email to your friend.',
  points: ['thank her', 'suggest a day'],
  words_min: 100,
  words_max: 140,
  time_min: 25,
  useful_language: ['Hi …,', 'Thanks for …', 'See you soon,'],
  tips_es: ['Un párrafo por idea.'],
  model_answer: Array.from({ length: 120 }, () => 'word').join(' '),
  provenance: { origin: 'human', created_at: '2026-10-09T00:00:00Z' },
  ...over,
});
const issues = (over: Partial<WritingPrompt> = {}, expected = { id: 'b1-wri-900', level: 'b1' }) =>
  checkWritingPrompt(prompt(over), expected);

describe('countWords', () => {
  it('cuenta lo que va entre espacios, como en un examen', () => {
    expect(countWords("I don't like well-known films.")).toBe(5);
    expect(countWords('  Hi Tom,\n\nHow are you?  ')).toBe(5);
    expect(countWords('It costs 20 euros.')).toBe(4);
  });

  it('los signos sueltos no cuentan y un texto vacío tiene cero palabras', () => {
    expect(countWords('Well — yes - no … !')).toBe(3);
    expect(countWords('')).toBe(0);
    expect(countWords('   \n ')).toBe(0);
  });
});

describe('splitParagraphs', () => {
  it('separa por saltos de línea y descarta los bloques vacíos', () => {
    expect(splitParagraphs('One.\n\nTwo.\n \nThree.\nFour.')).toEqual(['One.', 'Two.', 'Three.', 'Four.']);
    expect(splitParagraphs('')).toEqual([]);
  });
});

describe('checkWritingPrompt', () => {
  it('una consigna coherente no tiene problemas', () => {
    expect(issues()).toEqual([]);
  });

  it('el id, el nivel y la carpeta tienen que coincidir', () => {
    expect(issues({}, { id: 'b1-wri-901', level: 'b1' })).toHaveLength(1);
    expect(issues({}, { id: 'b1-wri-900', level: 'b2' })).toHaveLength(1);
    expect(issues({ id: 'b2-wri-900' }, { id: 'b2-wri-900', level: 'b1' })[0]).toMatch(/empezar/);
  });

  it('el tipo de texto tiene que trabajarse en ese nivel', () => {
    expect(issues({ task_type: 'proposal' })[0]).toMatch(/no se trabaja en B1/);
    expect(WRITING_TYPES_BY_LEVEL.A1).toEqual(['message']);
  });

  it('la longitud pedida no se sale de la del nivel', () => {
    expect(issues({ words_min: 90 })[0]).toMatch(/se sale/);
    expect(issues({ words_max: 160 })[0]).toMatch(/se sale/);
    expect(issues({ words_min: 140, words_max: 140 })[0]).toMatch(/menor/);
    expect(WRITING_WORDS.B1).toEqual({ min: 100, max: 150 });
  });

  it('la respuesta modelo cumple la longitud que pide la consigna', () => {
    const words = (n: number) => Array.from({ length: n }, () => 'word').join(' ');
    expect(issues({ model_answer: words(99) })[0]).toMatch(/99 palabras/);
    expect(issues({ model_answer: words(141) })[0]).toMatch(/141 palabras/);
    expect(issues({ model_answer: words(100) })).toEqual([]);
  });

  it('no admite puntos ni expresiones repetidas', () => {
    expect(issues({ points: ['thank her', 'Thank her '] })[0]).toMatch(/puntos repetidos/);
    expect(issues({ useful_language: ['Hi', 'hi', 'Bye'] })[0]).toMatch(/expresiones útiles/);
  });
});

describe('toPublicPrompt', () => {
  it('quita la respuesta modelo: solo se enseña después de entregar', () => {
    const shown = toPublicPrompt(prompt());
    expect(JSON.stringify(shown)).not.toContain('word word');
    expect(Object.keys(shown)).not.toContain('model_answer');
    expect(shown).toMatchObject({ id: 'b1-wri-900', title: 'A test email', points: ['thank her', 'suggest a day'] });
  });
});

// Las consignas del repositorio: además del esquema, su respuesta modelo tiene que pasar la
// misma revisión automática que se le hace al usuario. Si no la pasa, o la respuesta está mal
// o la revisión marca como fallo algo que es correcto.
describe('consignas publicadas', () => {
  const files = existsSync(ROOT)
    ? readdirSync(ROOT).flatMap((level) =>
        readdirSync(path.join(ROOT, level))
          .filter((name) => name.endsWith('.json'))
          .map((name) => ({ level, id: name.slice(0, -'.json'.length) })),
      )
    : [];

  it('hay consignas de los seis niveles', () => {
    expect(new Set(files.map((file) => file.level))).toEqual(
      new Set(['a1', 'a2', 'b1', 'b2', 'c1', 'c2']),
    );
  });

  it.each(files)('$id', ({ level, id }) => {
    const raw: unknown = JSON.parse(readFileSync(path.join(ROOT, level, `${id}.json`), 'utf8'));
    const parsed = WritingPrompt.parse(raw);
    expect(checkWritingPrompt(parsed, { id, level })).toEqual([]);

    const review = reviewText(parsed.model_answer, {
      level: parsed.level,
      taskType: parsed.task_type,
      wordsMin: parsed.words_min,
      wordsMax: parsed.words_max,
    });
    expect(
      review.hints
        .filter((hint) => hint.severity !== 'check')
        .map((hint) => `${hint.rule}: «${hint.match}»`),
    ).toEqual([]);
    expect(review.checks.filter((check) => !check.ok).map((check) => check.id)).toEqual([]);
  });
});
