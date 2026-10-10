import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkExamPaper, ExamPaper, ExamPaperId, parsePaperId } from './exam-schema';

type Json = Record<string, unknown>;

const read = (id: string): Json =>
  JSON.parse(readFileSync(path.join(process.cwd(), 'content', 'exams', 'b2', `${id}.json`), 'utf8')) as Json;

const READING = { id: 'b2-exam-01-reading', level: 'b2' };

/** Los problemas de la prueba de Reading del B2 tras tocarla con `change`. */
function issuesAfter(change: (parts: Json[]) => void): string[] {
  const raw = read(READING.id);
  change(raw.parts as Json[]);
  return checkExamPaper(ExamPaper.parse(raw), READING);
}

describe('ExamPaperId', () => {
  it('admite nivel, número de simulacro y prueba', () => {
    expect(ExamPaperId.safeParse('b2-exam-01-reading').success).toBe(true);
    expect(ExamPaperId.safeParse('c2-exam-12-speaking').success).toBe(true);
    expect(ExamPaperId.safeParse('b2-exam-1-reading').success).toBe(false);
    expect(ExamPaperId.safeParse('b2-exam-01-writing').success).toBe(false);
    expect(parsePaperId('a2-exam-03-listening')).toEqual({ level: 'a2', test: 3, paper: 'listening' });
    expect(parsePaperId('b2-uoe-001')).toBeNull();
  });
});

describe('checkExamPaper', () => {
  it('da por buena la prueba tal como está', () => {
    expect(issuesAfter(() => undefined)).toEqual([]);
  });

  it('exige el id, el nivel y la prueba del fichero', () => {
    const paper = ExamPaper.parse(read(READING.id));
    expect(checkExamPaper(paper, { id: 'b2-exam-02-reading', level: 'b2' })).toHaveLength(1);
    expect(checkExamPaper(paper, { id: READING.id, level: 'c1' })).toHaveLength(1);
  });

  it('exige las partes del examen, en su orden y con sus preguntas', () => {
    expect(issuesAfter((parts) => parts.pop())[0]).toMatch(/tiene 6 partes y el examen tiene 7/);
    expect(issuesAfter((parts) => parts.reverse()).join()).toMatch(/el examen pide «mcq_cloze»/);
    expect(
      issuesAfter((parts) => {
        (parts[0]!.gaps as Json[]).pop();
        parts[0]!.text = (parts[0]!.text as string).replace('{{8}}', 'stay');
      }).join(),
    ).toMatch(/parte 1: tiene 7 preguntas y el examen tiene 8/);
  });

  it('exige la numeración de corrido', () => {
    const issues = issuesAfter((parts) => {
      (parts[0]!.gaps as Json[])[0]!.n = 60;
      parts[0]!.text = (parts[0]!.text as string).replace('{{1}}', '{{60}}');
    });
    expect(issues.join()).toMatch(/se numeran de corrido/);
  });

  it('exige que los huecos del texto sean los de las preguntas', () => {
    const issues = issuesAfter((parts) => {
      parts[1]!.text = (parts[1]!.text as string).replace('{{12}}', 'as');
    });
    expect(issues.join()).toMatch(/parte 2: los huecos del texto/);
  });

  it('exige el número de opciones del examen y que la respuesta exista', () => {
    expect(
      issuesAfter((parts) => {
        ((parts[0]!.gaps as Json[])[0]!.options as string[]).pop();
      }).join(),
    ).toMatch(/hueco 1: tiene 3 opciones y el examen 4/);
    expect(
      issuesAfter((parts) => {
        const question = ((parts[4]!.groups as Json[])[0]!.questions as Json[])[0]!;
        question.options = ['same', 'same', 'other', 'another'];
      }).join(),
    ).toMatch(/pregunta 31: hay opciones repetidas/);
  });

  it('vigila las transformaciones: palabra dada, límite de palabras y frase original', () => {
    const edit = (change: (item: Json) => void) =>
      issuesAfter((parts) => change((parts[3]!.items as Json[])[0]!)).join();
    expect(edit((item) => (item.parts = [['should have'], ['left']]))).toMatch(
      /no contiene la palabra dada MUST/,
    );
    expect(edit((item) => (item.parts = [['must surely have really'], ['gone and left']]))).toMatch(
      /tiene 7 palabras \(límite 2–5\)/,
    );
    expect(edit((item) => (item.original = 'Peter must be the one who did it.'))).toMatch(
      /ya contiene la palabra dada/,
    );
    expect(edit((item) => (item.parts = [['must'], ['have left']]))).toMatch(/solo la palabra dada/);
  });

  it('en el texto con huecos, cada frase va a un solo hueco y sobra una', () => {
    expect(
      issuesAfter((parts) => {
        (parts[5]!.gaps as Json[])[1]!.answer = 'C';
      }).join(),
    ).toMatch(/una opción se usa en dos huecos/);
    expect(
      issuesAfter((parts) => {
        (parts[5]!.options as Json[]).pop();
        (parts[5]!.gaps as Json[])[4]!.answer = 'D';
      }).join(),
    ).toMatch(/tiene 6 opciones y el examen 7/);
  });

  it('al emparejar, la respuesta tiene que ser uno de los textos', () => {
    expect(
      issuesAfter((parts) => {
        ((parts[6]!.tasks as Json[])[0]!.questions as Json[])[0]!.answer = 'F';
      }).join(),
    ).toMatch(/pregunta 43: la respuesta no es una opción/);
  });

  it('una prueba de Listening necesita grabaciones, y una de Reading no las admite', () => {
    const listening = read('b2-exam-01-listening');
    const first = ((listening.parts as Json[])[0]!.groups as Json[])[0]!;
    const recording = first.recording as Json;
    delete first.recording;
    expect(
      checkExamPaper(ExamPaper.parse(listening), { id: 'b2-exam-01-listening', level: 'b2' }).join(),
    ).toMatch(/hay un grupo sin grabación/);

    expect(
      issuesAfter((parts) => {
        (parts[4]!.groups as Json[])[0]!.recording = recording;
      }).join(),
    ).toMatch(/una parte de Reading no lleva grabación/);
  });

  it('quien habla en una grabación tiene que estar entre sus hablantes', () => {
    const listening = read('b2-exam-01-listening');
    const recording = ((listening.parts as Json[])[0]!.groups as Json[])[0]!.recording as Json;
    (recording.segments as Json[])[0]!.speaker = 'nobody';
    expect(
      checkExamPaper(ExamPaper.parse(listening), { id: 'b2-exam-01-listening', level: 'b2' }).join(),
    ).toMatch(/«nobody» no está entre los hablantes/);
  });

  it('el Speaking tiene las partes del examen, en su orden', () => {
    const speaking = read('b2-exam-01-speaking');
    const expected = { id: 'b2-exam-01-speaking', level: 'b2' };
    expect(checkExamPaper(ExamPaper.parse(speaking), expected)).toEqual([]);
    (speaking.parts as Json[]).reverse();
    expect(checkExamPaper(ExamPaper.parse(speaking), expected).join()).toMatch(
      /no son las del examen \(interview, long_turn, collaborative, discussion\)/,
    );
  });
});
