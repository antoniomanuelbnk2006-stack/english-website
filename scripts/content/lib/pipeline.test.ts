import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { annotateLesson } from './annotate-lesson';
import { checkLesson } from './check-lesson';
import { stringifyContent } from './io';
import {
  coverageByLevel,
  countSyllables,
  fleschReadingEase,
  lessonDifficulty,
  offLevelLemmas,
} from './metrics';
import { countSentences, countWords, detokenize, tokenize } from './nlp';
import { checkProfile, checkTasks, literalOverlap, type LessonMetrics } from './qa';
import {
  baseFormCandidates,
  baseFormIn,
  buildWordLists,
  levelOf,
  loadWordLists,
  parseCsv,
} from './wordlists';

const lists = loadWordLists();
const lessonPath = (relative: string) => path.join(process.cwd(), 'content', 'lessons', relative);
const load = (relative: string): unknown => JSON.parse(readFileSync(lessonPath(relative), 'utf8'));
const LISTENING = 'b1/listening/b1-lis-001.json';
const READING = 'b1/reading/b1-rea-001.json';
const NOW = new Date('2026-10-08T12:00:00Z');

describe('parseCsv', () => {
  it('lee campos entre comillas, comillas escapadas, BOM y CRLF', () => {
    expect(parseCsv('﻿a,b\r\n"x, y","dice ""hola"""\r\n\r\n1,2')).toEqual([
      ['a', 'b'],
      ['x, y', 'dice "hola"'],
      ['1', '2'],
    ]);
  });
});

describe('listas de palabras', () => {
  const small = buildWordLists({
    cefrj:
      'headword,pos,CEFR\nshower,noun,A1\nshower,verb,B2\nairplane/aeroplane,noun,A2\naccording to,preposition,A2\n',
    octanove: 'headword,pos,CEFR,notes\ncloak,noun,C1,\n laud ,verb,C2,\n',
    ngsl: 'Lemma,SFI Rank,SFI,U\nthe,1,87,60910\nestimate,999,59,92\nwidget,2500,40,3\n',
  });

  it('se queda con el nivel más bajo entre las categorías de un lema', () => {
    expect(levelOf(small, 'shower', 'VERB')).toEqual({ level: 'A1', source: 'cefrj' });
  });

  it('trata las variantes ortográficas como el mismo lema y limpia espacios', () => {
    expect(levelOf(small, 'aeroplane', 'NOUN').level).toBe('A2');
    expect(levelOf(small, 'laud', 'VERB')).toEqual({ level: 'C2', source: 'octanove' });
    expect(small.levels.has('according to')).toBe(false);
  });

  it('las palabras gramaticales son A1 y las reducciones, B1', () => {
    expect(levelOf(small, 'whatever', 'PRON')).toEqual({ level: 'A1', source: 'function' });
    expect(levelOf(small, 'gonna', 'AUX')).toEqual({ level: 'B1', source: 'reduction' });
  });

  it('estima por frecuencia lo que no está en los perfiles y marca lo raro como C2', () => {
    expect(levelOf(small, 'estimate', 'NOUN')).toEqual({ level: 'A2', source: 'ngsl' });
    expect(levelOf(small, 'widget', 'NOUN')).toEqual({ level: 'B2', source: 'ngsl' });
    expect(levelOf(small, 'modder', 'NOUN')).toEqual({ level: 'C2', source: 'estimated' });
  });

  it('las listas reales tienen el tamaño esperado y niveles coherentes', () => {
    expect(lists.levels.size).toBeGreaterThan(8000);
    expect(lists.ngslRank.get('the')).toBe(1);
    expect(levelOf(lists, 'forecast', 'NOUN').level).toBe('B1');
    expect(levelOf(lists, 'telescope', 'NOUN').level).toBe('B2');
  });

  it('propone formas base de palabras sin lematizar', () => {
    expect(baseFormCandidates('modding')).toContain('mod');
    expect(baseFormCandidates('stories')).toContain('story');
    expect(baseFormIn(lists, 'raining')).toBe('rain');
    expect(baseFormIn(lists, 'modders')).toBeNull();
  });
});

describe('tokenize', () => {
  const pairs = (text: string, own?: Set<string>) =>
    tokenize(text, lists, own).map((t) => `${t.t}/${t.l}${t.w ? '' : '·'}`);

  it('reconstruye el texto original, contracciones incluidas', () => {
    for (const text of [
      "You can't see anything from here. There's way too much light.",
      "Perfect. I'll pick you up at half eleven.",
      'Actually, no. Meteors move too fast, and a telescope only shows you a tiny part of the sky.',
      'It means that the games they love will not disappear when the company moves on.',
    ]) {
      expect(detokenize(tokenize(text, lists))).toBe(text);
    }
  });

  it('lematiza contracciones y deja fuera de la cobertura puntuación, números y nombres propios', () => {
    expect(pairs("I'll pick you up at 11:30, Leo.")).toEqual([
      'I/i',
      "'ll/will",
      'pick/pick',
      'you/you',
      'up/up',
      'at/at',
      '11:30/11:30·',
      ',/,·',
      'Leo/leo·',
      './.·',
    ]);
  });

  it('no toma por nombre propio una palabra corriente al principio de frase', () => {
    expect(pairs('Perfect. Others are huge.').slice(0, 3)).toEqual([
      'Perfect/perfect',
      './.·',
      'Others/other',
    ]);
  });

  it('separa «no.» al final de frase en vez de leerlo como abreviatura', () => {
    expect(pairs('Actually, no.')).toEqual(['Actually/actually', ',/,·', 'no/no·', './.·']);
  });

  it('reconoce las reducciones y no cuenta el posesivo', () => {
    const tokens = tokenize("How many are we gonna see from Halley's Comet?", lists);
    expect(tokens.find((t) => t.t === 'gonna')).toMatchObject({ l: 'gonna', p: 'AUX', w: true });
    expect(tokens.find((t) => t.t === "'s")).toMatchObject({ w: false });
  });

  it('reduce palabras propias de la lección con ayuda del glosario', () => {
    const own = new Set(['mod', 'modder']);
    expect(pairs('These players are called modders.', own)).toContain('modders/modder');
    expect(pairs('Tools that make modding easier.', own)).toContain('modding/mod');
    expect(pairs('These players are called modders.')).toContain('modders/modders');
  });

  it('cuenta palabras y frases como las contaría una persona', () => {
    const tokens = tokenize("Sure. What's up? I don't know!", lists);
    expect(countWords(tokens)).toBe(6);
    expect(countSentences(tokens)).toBe(3);
  });
});

describe('métricas', () => {
  it('cobertura acumulada por nivel y lemas fuera de nivel', () => {
    const tokens = [
      { lemma: 'game', level: 'A1' as const },
      { lemma: 'game', level: 'A1' as const },
      { lemma: 'refuse', level: 'B1' as const },
      { lemma: 'employee', level: 'B2' as const },
    ];
    expect(coverageByLevel(tokens)).toEqual({ A1: 0.5, A2: 0.5, B1: 0.75, B2: 1, C1: 1, C2: 1 });
    expect(offLevelLemmas(tokens, 'B1')).toEqual(['employee']);
    expect(offLevelLemmas(tokens, 'B2')).toEqual([]);
  });

  it('sílabas y legibilidad', () => {
    expect(['game', 'player', 'community', 'the', 'release'].map(countSyllables)).toEqual([
      1, 2, 4, 1, 2,
    ]);
    expect(fleschReadingEase(['The', 'cat', 'sat'], 1)).toBeGreaterThan(100);
    expect(fleschReadingEase([], 0)).toBe(0);
  });

  it('la dificultad parte del centro del nivel y se ajusta por léxico, velocidad y acento', () => {
    const base = { skill: 'listening' as const, level: 'B1' as const, coverageAtLevel: 0.97 };
    expect(lessonDifficulty({ ...base, wpm: 135, accents: ['en-GB'] })).toBe(1100);
    expect(lessonDifficulty({ ...base, wpm: 145, accents: ['en-GB'] })).toBe(1115);
    expect(lessonDifficulty({ ...base, wpm: 135, accents: ['en-GB', 'en-AU'] })).toBe(1115);
    expect(lessonDifficulty({ ...base, wpm: 135, accents: ['en-US'], coverageAtLevel: 0.99 })).toBe(
      1080,
    );
  });

  it('cada ajuste tiene tope y el total no sale de la banda ± 50', () => {
    expect(
      lessonDifficulty({
        skill: 'listening',
        level: 'B1',
        coverageAtLevel: 0.5,
        wpm: 220,
        accents: ['en-IN'],
      }),
    ).toBe(1195);
    expect(
      lessonDifficulty({ skill: 'reading', level: 'B1', coverageAtLevel: 1, avgSentenceWords: 4 }),
    ).toBe(1040);
  });
});

describe('calidad de las tareas', () => {
  it('mide cuánto copia una opción a su evidencia, sin contar números ni nombres propios', () => {
    expect(
      literalOverlap(
        'Light pollution in the city',
        "That's the problem with the city: light pollution.",
      ),
    ).toBe(1);
    expect(
      literalOverlap(
        'So his eyes can adapt to the lack of light',
        'It takes about twenty minutes for your eyes to get used to the dark.',
      ),
    ).toBeLessThan(0.6);
    expect(
      literalOverlap('Fifteen to twenty an hour', 'Maybe fifteen or twenty an hour.'),
    ).toBeNull();
  });

  it('las lecciones de ejemplo superan todas las comprobaciones', () => {
    for (const file of [LISTENING, READING]) {
      const { issues } = annotateLesson(load(file), lists, NOW);
      expect(issues, file).toEqual([]);
    }
  });

  it('detecta la respuesta siempre en la misma letra y la opción correcta más larga', () => {
    const lesson = annotateLesson(load(LISTENING), lists, NOW).lesson as {
      tasks: { type: string; answer?: string; options?: { id: string; text: string }[] }[];
    };
    for (const task of lesson.tasks) {
      if (task.type !== 'mcq' || !task.options) continue;
      const correct = task.options.find((o) => o.id === task.answer);
      const first = task.options[0];
      if (!correct || !first) continue;
      // La correcta pasa a ser siempre la «a» y, además, la más larga.
      [first.text, correct.text] = [
        `${correct.text} and a few more words to stand out`,
        first.text,
      ];
      task.answer = 'a';
    }
    const checks = checkTasks(lesson as never).map((issue) => issue.check);
    expect(checks).toContain('answer-position');
    expect(checks).toContain('option-length');
  });

  it('exige rasgos de habla conectada en las frases dictadas y segmentos cortos', () => {
    const lesson = annotateLesson(load(LISTENING), lists, NOW).lesson as {
      connected_speech: { ref: string }[];
      segments: { id: string; text: string }[];
    };
    lesson.connected_speech = lesson.connected_speech.filter((feature) => feature.ref !== 's16');
    lesson.segments[2]!.text = `${lesson.segments[2]!.text} ${'and then we will see more and more '.repeat(3)}`;
    const issues = checkTasks(lesson as never);
    expect(issues.map((i) => i.message)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('segmento s3'),
        expect.stringContaining('el segmento s16 no tiene ningún rasgo'),
      ]),
    );
  });
});

describe('perfil del nivel', () => {
  const metrics: LessonMetrics = {
    coverageAtLevel: 0.97,
    offLevelLemmas: [],
    unglossedLemmas: [],
    avgSentenceWords: 12,
    wordCount: 400,
  };
  const b1 = annotateLesson(load(READING), lists, NOW).lesson as never;

  it('acepta un texto dentro de los umbrales de B1', () => {
    expect(checkProfile(b1, metrics)).toEqual([]);
  });

  it('avisa de cobertura baja, palabras sin glosar, frases largas y longitud fuera de rango', () => {
    const checks = checkProfile(b1, {
      coverageAtLevel: 0.93,
      offLevelLemmas: Array.from({ length: 14 }, (_, i) => `rare${i}`),
      unglossedLemmas: ['rare1'],
      avgSentenceWords: 19,
      wordCount: 250,
    }).map((issue) => issue.check);
    expect(checks).toEqual(['coverage', 'off-level', 'glossary', 'sentence-length', 'length']);
  });
});

describe('annotateLesson', () => {
  it('reproduce la dificultad del ejemplo de la documentación (1095)', () => {
    expect(annotateLesson(load(LISTENING), lists, NOW).metrics.difficulty).toBe(1095);
  });

  it('es idempotente: reanotar una lección anotada no cambia nada', () => {
    for (const file of [LISTENING, READING]) {
      const current = load(file);
      const again = annotateLesson(current, lists, new Date('2030-01-01T00:00:00Z')).lesson;
      expect(stringifyContent(again), file).toBe(stringifyContent(current));
    }
  });

  it('conserva los tiempos del audio si el texto no cambia y los descarta si cambia', () => {
    const lesson = load(LISTENING) as {
      segments: { text: string; tokens: Record<string, unknown>[] }[];
    };
    lesson.segments[1]!.tokens = lesson.segments[1]!.tokens.map((token, i) => ({
      ...token,
      s: i,
      e: i + 0.5,
    }));
    const kept = annotateLesson(lesson, lists, NOW).lesson as typeof lesson;
    expect(kept.segments[1]!.tokens[0]).toMatchObject({ s: 0, e: 0.5 });

    lesson.segments[1]!.text = 'Sure. What is it?';
    const dropped = annotateLesson(lesson, lists, NOW).lesson as typeof lesson;
    expect(dropped.segments[1]!.tokens[0]).not.toHaveProperty('s');
  });
});

describe('checkLesson', () => {
  it('da por buenas las lecciones del repositorio', () => {
    expect(checkLesson(load(LISTENING), lists, { relativePath: LISTENING })).toMatchObject({
      status: 'draft',
      errors: [],
      warnings: [],
    });
    expect(checkLesson(load(READING), lists, { relativePath: READING })).toMatchObject({
      status: 'published',
      errors: [],
      warnings: [],
    });
  });

  it('detecta anotaciones desfasadas cuando el texto cambia sin reanotar', () => {
    const lesson = load(READING) as { paragraphs: { sentences: { text: string }[] }[] };
    lesson.paragraphs[0]!.sentences[1]!.text =
      'New games arrive every week, and old ones are soon forgotten.';
    const report = checkLesson(lesson, lists, { relativePath: READING });
    expect(report.errors).toEqual([expect.stringContaining('ejecuta pnpm content:annotate')]);
  });

  it('exige el esquema completo a una lección publicada', () => {
    const lesson = { ...(load(LISTENING) as object), status: 'published' };
    const report = checkLesson(lesson, lists, { relativePath: LISTENING });
    // Los errores repetidos por segmento se agrupan para que se vea también el que falta el audio.
    expect(report.errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^esquema · segments\.\*\.start: .*\(29 veces\)$/),
        expect.stringMatching(/^esquema · audio: /),
      ]),
    );
  });

  it('en un borrador los problemas de calidad son avisos; publicado, errores', () => {
    const draft = load(LISTENING) as { glossary: { lemma: string }[]; status: string };
    draft.glossary = draft.glossary.filter((entry) => entry.lemma !== 'telescope');
    const asDraft = checkLesson(draft, lists, { relativePath: LISTENING });
    expect(asDraft.errors).toEqual([]);
    expect(asDraft.warnings).toEqual([expect.stringContaining('telescope')]);

    const published = load(READING) as { glossary: { lemma: string }[] };
    published.glossary = published.glossary.filter((entry) => entry.lemma !== 'feedback');
    const asPublished = checkLesson(published, lists, { relativePath: READING });
    expect(asPublished.errors).toEqual([expect.stringContaining('feedback')]);
  });

  it('exige subir la versión si cambia una lección ya publicada (I-12)', () => {
    const previous = load(READING);
    const current = load(READING) as { tasks: { prompt: string }[] };
    current.tasks[0]!.prompt = 'What is the main idea of the text?';
    const report = checkLesson(current, lists, { relativePath: READING, previous });
    expect(report.errors).toEqual([expect.stringContaining('I-12')]);
  });
});

describe('stringifyContent', () => {
  it('deja en una línea los objetos pequeños y reparte las listas largas', () => {
    const text = stringifyContent({
      id: 'x',
      tokens: [{ t: 'Hi', l: 'hi', p: 'INTJ', w: false }],
      lemmas: Array.from({ length: 40 }, (_, i) => `lemma${i}`),
      empty: [],
    });
    expect(text).toContain('{ "t": "Hi", "l": "hi", "p": "INTJ", "w": false }');
    expect(text).toContain('"empty": []');
    expect(Math.max(...text.split('\n').map((line) => line.length))).toBeLessThanOrEqual(112);
    expect(JSON.parse(text)).toMatchObject({ id: 'x', empty: [] });
  });
});
