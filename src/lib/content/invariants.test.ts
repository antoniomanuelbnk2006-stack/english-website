import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { checkInvariants, checkVersionBump, type InvariantCode } from './invariants';
import {
  Lesson,
  LessonDraft,
  ListeningDraft,
  PublishedListening,
  PublishedReading,
} from './schema';

type Listening = z.infer<typeof PublishedListening>;
type Reading = z.infer<typeof PublishedReading>;

const lessonsDir = path.join(process.cwd(), 'content', 'lessons');
const readJson = (relative: string): unknown =>
  JSON.parse(readFileSync(path.join(lessonsDir, relative), 'utf8'));

// Las dos lecciones de ejemplo de la documentación sirven de datos de prueba.
const listening = (): Listening =>
  PublishedListening.parse(readJson('b1/listening/b1-lis-001.json'));
// Las dos están publicadas (con tokens, lemas, informe de calidad y, la escucha, su audio).
const reading = (): Reading => PublishedReading.parse(readJson('b1/reading/b1-rea-001.json'));

const codes = (lesson: Parameters<typeof checkInvariants>[0], relativePath?: string) =>
  checkInvariants(lesson, { relativePath }).map((issue) => issue.code);

function task<T extends Listening | Reading>(lesson: T, id: string) {
  const found = lesson.tasks.find((t) => t.id === id);
  if (!found) throw new Error(`no existe la tarea ${id}`);
  return found;
}

describe('lecciones de ejemplo', () => {
  it('cumplen el esquema y todas las invariantes', () => {
    expect(checkInvariants(listening(), { relativePath: 'b1/listening/b1-lis-001.json' })).toEqual(
      [],
    );
    expect(checkInvariants(reading(), { relativePath: 'b1/reading/b1-rea-001.json' })).toEqual([]);
  });

  it('se validan también como unión LessonDraft', () => {
    expect(LessonDraft.parse(readJson('b1/listening/b1-lis-001.json')).skill).toBe('listening');
    expect(Lesson.parse(readJson('b1/reading/b1-rea-001.json')).skill).toBe('reading');
  });
});

describe('I-1 · identidad y ubicación', () => {
  it('detecta un fichero en la carpeta equivocada', () => {
    expect(codes(listening(), 'b2/listening/b1-lis-001.json')).toEqual(['I-1']);
    expect(codes(listening(), 'b1/reading/b1-lis-001.json')).toEqual(['I-1']);
    expect(codes(listening(), 'b1/listening/b1-lis-002.json')).toEqual(['I-1']);
  });

  it('detecta un id que no corresponde al nivel o a la destreza', () => {
    const lesson = listening();
    lesson.level = 'B2';
    expect(codes(lesson)).toContain('I-1');
    const text = reading();
    text.id = 'b1-lis-009';
    expect(codes(text)).toContain('I-1');
  });
});

describe('I-2 · identificadores únicos', () => {
  it('detecta tareas, segmentos y frases repetidos', () => {
    const lesson = listening();
    task(lesson, 'q2').id = 'q1';
    expect(codes(lesson)).toContain('I-2');

    const segments = listening();
    segments.segments[1]!.id = 's1';
    expect(codes(segments)).toContain('I-2');

    const text = reading();
    text.paragraphs[0]!.sentences[1]!.id = 'p1s1';
    expect(codes(text)).toContain('I-2');
  });

  it('detecta una frase cuyo id no es de su párrafo', () => {
    const text = reading();
    text.paragraphs[1]!.sentences[0]!.id = 'p9s1';
    expect(codes(text)).toContain('I-2');
  });
});

describe('I-3 · referencias', () => {
  it('detecta un id de evidencia roto', () => {
    const lesson = listening();
    task(lesson, 'q3').evidence = ['s8', 's99'];
    const issues = checkInvariants(lesson);
    expect(issues).toEqual([{ code: 'I-3', message: 'tarea q3: evidence «s99» no existe' }]);
  });

  it('detecta una evidencia de lectura que apunta a una frase inexistente', () => {
    const text = reading();
    task(text, 'q4').evidence = ['p3s9'];
    expect(codes(text)).toEqual(['I-3']);
  });

  it('detecta refs rotas en glosario, habla conectada y foco lingüístico', () => {
    const lesson = listening();
    lesson.glossary[0]!.ref = 's77';
    lesson.connected_speech[0]!.ref = 's88';
    expect(codes(lesson)).toEqual(['I-3', 'I-3']);

    const text = reading();
    text.language_focus[0]!.refs = ['p7s1'];
    expect(codes(text)).toEqual(['I-3']);
  });

  it('detecta un dictado cuyo segmento no existe o cuya referencia no es el texto del segmento', () => {
    const lesson = listening();
    const dictation = task(lesson, 'q12');
    if (dictation.type !== 'dictation') throw new Error('q12 debe ser un dictado');
    dictation.reference = 'How many meteors are we going to see?';
    expect(codes(lesson)).toEqual(['I-3']);
    dictation.segment = 's55';
    expect(codes(lesson)).toContain('I-3');
  });
});

describe('I-4 · claves de respuesta', () => {
  it('detecta un answer inexistente', () => {
    const lesson = listening();
    const mcq = task(lesson, 'q1');
    if (mcq.type !== 'mcq') throw new Error('q1 debe ser mcq');
    mcq.answer = 'e';
    expect(checkInvariants(lesson)).toEqual([
      { code: 'I-4', message: 'tarea q1: answer «e» no es una opción' },
    ]);
  });

  it('detecta títulos y párrafos mal asignados en heading_match', () => {
    const text = reading();
    const headings = task(text, 'q2');
    if (headings.type !== 'heading_match') throw new Error('q2 debe ser heading_match');
    headings.answers = { p3: 'a', p4: 'z' };
    const messages = checkInvariants(text).map((i) => i.message);
    expect(messages).toEqual([
      'tarea q2: answers usa el título «z», que no existe',
      'tarea q2: el párrafo «p5» no tiene título asignado',
    ]);
  });

  it('detecta un NG cuando la tarea no lo admite', () => {
    const lesson = listening();
    const tf = task(lesson, 'q10');
    if (tf.type !== 'true_false_ng') throw new Error('q10 debe ser true_false_ng');
    tf.allow_ng = false;
    expect(codes(lesson)).toEqual(['I-4']);
  });
});

describe('I-5 · fases', () => {
  it('rechaza fases de lectura en una escucha y al revés', () => {
    const lesson = listening();
    task(lesson, 'q1').phase = 'skim';
    expect(codes(lesson)).toEqual(['I-5']);
    const text = reading();
    task(text, 'q3').phase = 'listen_2';
    expect(codes(text)).toEqual(['I-5']);
  });
});

describe('I-6 · hablantes', () => {
  it('detecta un segmento con un hablante no declarado', () => {
    const lesson = listening();
    lesson.segments[4]!.speaker = 'sam';
    expect(codes(lesson)).toEqual(['I-6']);
  });
});

describe('I-7 · frases literales', () => {
  it('detecta una surface del glosario que no está en su frase', () => {
    const text = reading();
    const entry = text.glossary.find((g) => g.lemma === 'turn into');
    if (!entry) throw new Error('falta la entrada turn into');
    entry.surface = 'turn into';
    expect(checkInvariants(text)).toEqual([
      { code: 'I-7', message: 'glosario «turn into»: «turn into» no aparece literalmente en p2s5' },
    ]);
  });

  it('no distingue mayúsculas ni apóstrofos tipográficos', () => {
    const lesson = listening();
    lesson.glossary[0]!.surface = 'WHAT’S UP';
    expect(codes(lesson)).toEqual([]);
  });

  it('detecta una frase de habla conectada que no es literal', () => {
    const lesson = listening();
    lesson.connected_speech[3]!.phrase = 'are we going to see';
    expect(codes(lesson)).toEqual(['I-7']);
  });
});

describe('I-8 · huecos', () => {
  it('detecta marcas que no coinciden con gaps', () => {
    const lesson = listening();
    const gaps = task(lesson, 'q11');
    if (gaps.type !== 'gap_fill') throw new Error('q11 debe ser gap_fill');
    gaps.text = 'The Orionids are tiny bits of {{1}} that the comet left behind.';
    expect(codes(lesson)).toEqual(['I-8']);
  });
});

describe('lecciones publicadas', () => {
  /** La escucha de ejemplo con audio y tiempos inventados: 2 s por segmento, palabras repartidas. */
  function publishedListening(): z.infer<typeof PublishedListening> {
    const raw = readJson('b1/listening/b1-lis-001.json') as {
      segments: { tokens: { t: string; s?: number; e?: number }[]; start?: number; end?: number }[];
    } & Record<string, unknown>;
    raw.segments.forEach((segment, i) => {
      segment.start = i * 2;
      segment.end = i * 2 + 1.8;
      const step = 1.8 / segment.tokens.length;
      segment.tokens.forEach((token, j) => {
        if (/\p{L}/u.test(token.t)) {
          token.s = Number((i * 2 + j * step).toFixed(3));
          token.e = Number((i * 2 + (j + 1) * step).toFixed(3));
        }
      });
    });
    return PublishedListening.parse({
      ...raw,
      status: 'published',
      provenance: { ...(raw.provenance as object), reviewed_by: 'test' },
      audio: {
        src: 'audio/b1/b1-lis-001/v1.m4a',
        duration_s: raw.segments.length * 2,
        wpm: 140,
        provider: 'azure',
        voices: { maya: 'en-GB-SoniaNeural', leo: 'en-US-AndrewNeural' },
        peaks: [0.1, 0.8, 0.4],
      },
    });
  }

  it('una escucha publicada con tiempos coherentes no da problemas', () => {
    expect(checkInvariants(publishedListening())).toEqual([]);
  });

  it('I-9 · detecta segmentos solapados, invertidos o más largos que el audio', () => {
    const overlapping = publishedListening();
    overlapping.segments[3]!.start = 1;
    expect(codes(overlapping)).toContain('I-9');

    const inverted = publishedListening();
    inverted.segments[0]!.end = 0;
    expect(codes(inverted)).toContain('I-9');

    const short = publishedListening();
    short.audio.duration_s = 10;
    expect(codes(short)).toEqual(['I-9']);
  });

  it('I-9 · detecta una palabra fuera de su segmento', () => {
    const lesson = publishedListening();
    const token = lesson.segments[1]!.tokens[0]!;
    token.s = 50;
    token.e = 51;
    expect(codes(lesson)).toEqual(['I-9']);
  });

  it('I-10 · lemmas debe coincidir con los lemas contables de los tokens', () => {
    const missing = reading();
    missing.lemmas = missing.lemmas.filter((lemma) => lemma !== 'game');
    expect(codes(missing)).toEqual(['I-10']);

    const unsorted = reading();
    unsorted.lemmas = [...unsorted.lemmas].reverse();
    expect(codes(unsorted)).toEqual(['I-10']);
  });

  it('I-11 · exige revisor automático o revisión humana', () => {
    const unreviewed = reading();
    delete unreviewed.provenance.reviewed_by;
    expect(codes(unreviewed)).toEqual(['I-11']);
  });

  it('I-11 · rechaza preguntas que se aciertan sin leer el texto', () => {
    const guessable = reading();
    guessable.qa.reviewer = {
      model: 'claude-opus-5-5',
      level_ok: true,
      answerable_with_text: 1,
      answerable_without_text: 0.6,
      issues: [],
      score: 8,
    };
    expect(codes(guessable)).toEqual(['I-11']);
    guessable.qa.reviewer.answerable_without_text = 0.3;
    expect(codes(guessable)).toEqual([]);
  });

  it('I-11 · una lección marcada como publicada sin anotar no pasa', () => {
    // El borrador, tal como sale de escribirlo: sin tokens, tiempos, audio ni informe.
    const lesson = { ...ListeningDraft.parse(listening()), status: 'published' as const };
    expect(codes(lesson)).toEqual(['I-11']);
  });
});

describe('I-12 · versión', () => {
  const published = () => ({ ...listening(), status: 'published' as const });

  it('exige subir version si cambia el texto o una tarea de una lección publicada', () => {
    const changedText = published();
    changedText.segments[0]!.text = 'Hi Leo, have you got a minute?';
    expect(checkVersionBump(published(), changedText).map((i) => i.code)).toEqual<InvariantCode[]>([
      'I-12',
    ]);

    const changedTask = published();
    task(changedTask, 'q1').prompt = 'Why does Maya phone Leo?';
    expect(checkVersionBump(published(), changedTask)).toHaveLength(1);
  });

  it('acepta el cambio si sube la versión', () => {
    const next = published();
    next.segments[0]!.text = 'Hi Leo, have you got a minute?';
    next.version = 2;
    expect(checkVersionBump(published(), next)).toEqual([]);
  });

  it('no afecta a borradores ni a cambios que no tocan texto o tareas', () => {
    const draft = () => ({ ...listening(), status: 'draft' as const });
    const draftChanged = draft();
    draftChanged.segments[0]!.text = 'Hi!';
    expect(checkVersionBump(draft(), draftChanged)).toEqual([]);

    const glossaryOnly = published();
    glossaryOnly.glossary[0]!.def_es = '¿qué hay?';
    expect(checkVersionBump(published(), glossaryOnly)).toEqual([]);
  });
});
