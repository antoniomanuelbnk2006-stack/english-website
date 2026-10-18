import { describe, expect, it } from 'vitest';
import {
  checkForm,
  expectedParagraphs,
  isFormal,
  linkersIn,
  overusedWords,
  reviewText,
  splitSentences,
  type FormCheck,
  type FormInput,
} from './checks';

const B2_ESSAY: FormInput = { level: 'B2', taskType: 'essay', wordsMin: 140, wordsMax: 190 };
const words = (n: number) => Array.from({ length: n }, () => 'word').join(' ');
const byId = (checks: FormCheck[]) => new Map(checks.map((check) => [check.id, check]));

describe('splitSentences', () => {
  it('parte por el punto final y por los saltos de línea, con posiciones exactas', () => {
    const text = 'Hi Anna,\n\nThanks for your email. How are you?  I am fine!';
    const sentences = splitSentences(text);
    expect(sentences.map((s) => s.text)).toEqual([
      'Hi Anna,',
      'Thanks for your email.',
      'How are you?',
      'I am fine!',
    ]);
    for (const sentence of sentences) {
      expect(text.slice(sentence.start, sentence.end)).toBe(sentence.text);
    }
  });

  it('una abreviatura con puntos no parte la frase', () => {
    expect(splitSentences('It opens at 9 a.m. and closes late. Bring e.g. a book.')).toHaveLength(
      2,
    );
  });

  it('una frase sin punto final también cuenta', () => {
    expect(splitSentences('See you soon').map((s) => s.text)).toEqual(['See you soon']);
    expect(splitSentences('')).toEqual([]);
  });
});

describe('checkForm', () => {
  it('la longitud se mide contra el intervalo de la consigna', () => {
    const length = (n: number) => byId(checkForm(words(n), B2_ESSAY)).get('length');
    expect(length(139)).toMatchObject({ ok: false, words: 139, min: 140, max: 190 });
    expect(length(140)).toMatchObject({ ok: true });
    expect(length(190)).toMatchObject({ ok: true });
    expect(length(191)).toMatchObject({ ok: false });
  });

  it('pide párrafos según el tipo de texto y el nivel', () => {
    expect(expectedParagraphs('message', 'A1')).toBe(1);
    expect(expectedParagraphs('email', 'A2')).toBe(1);
    expect(expectedParagraphs('email', 'B1')).toBe(3);
    expect(expectedParagraphs('story', 'B1')).toBe(2);
    expect(expectedParagraphs('essay', 'B2')).toBe(4);
    expect(expectedParagraphs('report', 'B2')).toBe(3);

    const one = byId(checkForm(words(150), B2_ESSAY)).get('paragraphs');
    expect(one).toMatchObject({ ok: false, count: 1, expected: 4 });
    const four = byId(checkForm([1, 2, 3, 4].map(() => words(40)).join('\n\n'), B2_ESSAY));
    expect(four.get('paragraphs')).toMatchObject({ ok: true, count: 4 });
  });

  it('en A1 y A2 no se piden párrafos, conectores avanzados ni frases cortas', () => {
    const checks = byId(
      checkForm('Hi Tom, I am Ana. Bye!', {
        level: 'A1',
        taskType: 'message',
        wordsMin: 25,
        wordsMax: 50,
      }),
    );
    expect([...checks.keys()]).toEqual(['length', 'greeting', 'closing']);
  });

  it('en un correo busca el saludo y la despedida, y no los cuenta como párrafos', () => {
    const email = [
      'Hi Anna,',
      `Thanks for your email. ${words(20)}`,
      `However, ${words(20)}`,
      `Also, ${words(20)} because ${words(5)}`,
      'Best wishes,',
      'Antonio',
    ].join('\n\n');
    const checks = byId(
      checkForm(email, { level: 'B1', taskType: 'email', wordsMin: 100, wordsMax: 150 }),
    );
    expect(checks.get('greeting')).toMatchObject({ ok: true });
    expect(checks.get('closing')).toMatchObject({ ok: true });
    expect(checks.get('paragraphs')).toMatchObject({ ok: true, count: 3, expected: 3 });

    const bare = byId(
      checkForm(words(110), { level: 'B1', taskType: 'email', wordsMin: 100, wordsMax: 150 }),
    );
    expect(bare.get('greeting')).toMatchObject({ ok: false });
    expect(bare.get('closing')).toMatchObject({ ok: false });
  });

  it('en un informe pide títulos de sección', () => {
    const report = [
      'Introduction',
      `The aim of this report is ${words(25)}.`,
      'Sports facilities',
      `At present ${words(30)}.`,
      'Recommendations',
      `I would recommend ${words(30)}.`,
    ].join('\n\n');
    const task: FormInput = { level: 'B2', taskType: 'report', wordsMin: 140, wordsMax: 190 };
    const checks = byId(checkForm(report, task));
    expect(checks.get('headings')).toMatchObject({ ok: true, count: 3 });
    expect(checks.get('paragraphs')).toMatchObject({ ok: true, count: 3 });
    expect(byId(checkForm(words(150), task)).get('headings')).toMatchObject({
      ok: false,
      count: 0,
    });
  });

  it('cuenta los conectores distintos; los básicos solo valen hasta A2', () => {
    const text =
      'I like it because it is cheap. However, it is slow, and on the other hand it is old.';
    expect(linkersIn(text, 'B2')).toEqual(['however', 'on the other hand']);
    expect(linkersIn(text, 'A2')).toEqual(['and', 'because', 'however', 'on the other hand']);
    expect(byId(checkForm(text, B2_ESSAY)).get('linkers')).toMatchObject({
      ok: false,
      expected: 4,
    });
  });

  it('avisa de las palabras comodín que se repiten', () => {
    const text =
      'It is a very good film with a very good story and very good music. The good thing is the end.';
    expect(overusedWords(text)).toEqual([
      { word: 'good', count: 4 },
      { word: 'very', count: 3 },
    ]);
    expect(overusedWords('It is a good film.')).toEqual([]);
  });

  it('avisa de las frases demasiado largas', () => {
    const long = `${words(36)}. Short one.`;
    expect(byId(checkForm(long, B2_ESSAY)).get('long_sentences')).toMatchObject({
      ok: false,
      count: 1,
      limit: 35,
    });
    const c1: FormInput = { level: 'C1', taskType: 'essay', wordsMin: 220, wordsMax: 260 };
    expect(byId(checkForm(long, c1)).get('long_sentences')).toMatchObject({ ok: true, limit: 45 });
  });
});

describe('reviewText', () => {
  it('junta el recuento, la forma y los posibles errores', () => {
    const review = reviewText("I am agree. People is nice and I don't like it!", B2_ESSAY);
    expect(review.words).toBe(11);
    expect(review.checks[0]).toMatchObject({ id: 'length', ok: false });
    // Es un ensayo: además de los errores, avisa del registro.
    expect(review.hints.map((hint) => hint.rule)).toEqual([
      'be-agree',
      'people-is',
      'formal-contraction',
      'formal-exclamation',
    ]);
  });

  it('en otro idioma solo valen las comprobaciones que no dependen de la lengua', () => {
    const message: FormInput = {
      language: 'es',
      level: 'A1',
      taskType: 'message',
      wordsMin: 25,
      wordsMax: 50,
    };
    const text = 'Hola Leo, me llamo Marta y soy de Sevilla. Trabajo en una librería.';
    const review = reviewText(text, message);
    // Sin saludo, despedida, conectores ni palabras repetidas: son listas de inglés.
    expect(review.checks.map((check) => check.id)).toEqual(['length']);
    // Y las reglas de errores típicos del inglés no se aplican a un texto en español.
    expect(review.hints).toEqual([]);
    expect(
      reviewText('I am agree.', { ...message, language: 'en' }).hints.map((hint) => hint.rule),
    ).toEqual(['be-agree']);
  });

  it('solo ensayo, informe y propuesta se revisan como texto formal', () => {
    expect(isFormal('essay')).toBe(true);
    expect(isFormal('report')).toBe(true);
    expect(isFormal('proposal')).toBe(true);
    expect(isFormal('email')).toBe(false);
    expect(isFormal('review')).toBe(false);
  });
});
