import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { EXAM_FORMATS } from '@/lib/content/exam-formats';
import { localize } from '@/lib/content/help';
import {
  checkExamPaper,
  ExamPaper,
  partNumbers,
  toPublicPaper,
  type ExamPart,
  type QuestionPaper,
} from '@/lib/content/exam-schema';
import { gradeExamPaper, gradeSpeaking, isAnswered, type ExamAnswers } from './grade';

const ROOT = path.join(process.cwd(), 'content', 'exams');

function load(id: string): QuestionPaper {
  const level = id.slice(0, 2);
  // Como en la app: las ayudas, resueltas al idioma de la interfaz.
  const paper = localize(
    ExamPaper.parse(JSON.parse(readFileSync(path.join(ROOT, level, `${id}.json`), 'utf8'))),
    'es',
  );
  if (paper.paper === 'speaking') throw new Error('no es una prueba con preguntas');
  return paper;
}

/** Las respuestas correctas de una parte, tal como las mandaría el navegador. */
function key(part: ExamPart): [number, string | number][] {
  switch (part.type) {
    case 'mcq':
      return part.groups.flatMap((group) =>
        group.questions.map((question): [number, number] => [question.n, question.answer]),
      );
    case 'mcq_cloze':
      return part.gaps.map((gap) => [gap.n, gap.answer]);
    case 'open_cloze':
    case 'word_formation':
    case 'completion':
      return part.gaps.map((gap) => [gap.n, gap.accept[0] ?? '']);
    case 'gapped_text':
      return part.gaps.map((gap) => [gap.n, gap.answer]);
    case 'matching':
      return part.tasks.flatMap((task) =>
        task.questions.map((question): [number, string] => [question.n, question.answer]),
      );
    case 'key_word_transformation':
      return part.items.map((item) => [item.n, `${item.parts[0][0]} ${item.parts[1][0]}`]);
    case 'writing':
      return [];
  }
}

const allCorrect = (paper: QuestionPaper): ExamAnswers =>
  Object.fromEntries(paper.parts.flatMap(key));

describe('gradeExamPaper · B2 First, Reading and Use of English', () => {
  const paper = load('b2-exam-01-reading');

  it('con todo bien da los 70 puntos y la nota máxima en las dos secciones', () => {
    const result = gradeExamPaper(paper, allCorrect(paper));
    expect(result.marks).toBe(70);
    expect(result.total).toBe(70);
    expect(result.score).toBe(1);
    expect(result.questions).toBe(52);
    expect(result.answered).toBe(52);
    expect(result.sections).toEqual([
      { section: 'reading', marks: 42, total: 42, scale: 190, band: 'grade_a', passed: true },
      {
        section: 'use_of_english',
        marks: 28,
        total: 28,
        scale: 190,
        band: 'grade_a',
        passed: true,
      },
    ]);
    expect(result.parts.map((part) => part.total)).toEqual([8, 8, 8, 12, 12, 12, 10]);
  });

  it('en blanco da cero y ninguna nota en la escala', () => {
    const result = gradeExamPaper(paper, {});
    expect(result.marks).toBe(0);
    expect(result.answered).toBe(0);
    expect(result.sections.every((section) => section.scale === null && !section.passed)).toBe(
      true,
    );
    expect(result.parts[0]?.items[0]).toMatchObject({ n: 1, given: '', correct: false });
  });

  it('las partes 5 y 6 valen dos puntos por pregunta y la 7, uno', () => {
    const result = gradeExamPaper(paper, { 31: 2, 37: 'C', 43: 'A' });
    expect(result.parts[4]).toMatchObject({ part: 5, marks: 2, total: 12 });
    expect(result.parts[5]).toMatchObject({ part: 6, marks: 2, total: 12 });
    expect(result.parts[6]).toMatchObject({ part: 7, marks: 1, total: 10 });
    expect(result.marks).toBe(5);
  });

  it('una transformación a medias vale un punto, y fuera del límite de palabras, ninguno', () => {
    // 25 · Peter ___ the door unlocked. (MUST) → must have left
    expect(gradeExamPaper(paper, { 25: 'must have left' }).parts[3]?.items[0]).toMatchObject({
      marks: 2,
      correct: true,
    });
    expect(gradeExamPaper(paper, { 25: 'must have forgotten' }).parts[3]?.items[0]).toMatchObject({
      marks: 1,
      correct: false,
    });
    expect(
      gradeExamPaper(paper, { 25: 'must surely have gone and left' }).parts[3]?.items[0],
    ).toMatchObject({ marks: 0, note: 'word_limit' });
    expect(gradeExamPaper(paper, { 25: 'has left' }).parts[3]?.items[0]).toMatchObject({
      marks: 0,
      note: 'keyword',
    });
    // Con contracción es la misma respuesta.
    expect(gradeExamPaper(paper, { 27: "if I hadn't felt" }).parts[3]?.items[2]?.marks).toBe(2);
  });

  it('acepta las letras en minúscula y las respuestas con mayúsculas o espacios de más', () => {
    const result = gradeExamPaper(paper, { 37: 'c', 9: ' No ', 17: 'ATTRACTION' });
    expect(result.marks).toBe(2 + 1 + 1);
  });

  it('enseña la opción elegida y la correcta con su letra', () => {
    const item = gradeExamPaper(paper, { 1: 0 }).parts[0]?.items[0];
    expect(item).toMatchObject({ given: 'A. narrow', answer: 'B. tight', correct: false });
  });

  it('con 24 de Reading y 18 de Use of English se aprueba justo (160)', () => {
    const answers: Record<number, string | number> = {};
    const correct = allCorrect(paper);
    // Reading: parte 1 (8) + parte 5 (6 × 2 = 12) + 4 de la parte 7 = 24.
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 31, 32, 33, 34, 35, 36, 43, 44, 45, 46]) {
      answers[n] = correct[n]!;
    }
    // Use of English: partes 2 y 3 (16) + una transformación (2) = 18.
    for (const n of [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25]) {
      answers[n] = correct[n]!;
    }
    const result = gradeExamPaper(paper, answers);
    expect(result.sections).toEqual([
      { section: 'reading', marks: 24, total: 42, scale: 160, band: 'grade_c', passed: true },
      {
        section: 'use_of_english',
        marks: 18,
        total: 28,
        scale: 160,
        band: 'grade_c',
        passed: true,
      },
    ]);
  });
});

describe('simulacros publicados', () => {
  const files = existsSync(ROOT)
    ? readdirSync(ROOT).flatMap((level) =>
        readdirSync(path.join(ROOT, level))
          .filter((name) => name.endsWith('.json'))
          .map((name) => ({ level, id: name.replace(/\.json$/, '') })),
      )
    : [];

  it('hay al menos un simulacro', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('$id cumple el formato oficial y se corrige entero', ({ level, id }) => {
    const raw = ExamPaper.parse(
      JSON.parse(readFileSync(path.join(ROOT, level, `${id}.json`), 'utf8')),
    );
    expect(checkExamPaper(raw, { id, level })).toEqual([]);
    const paper = localize(raw, 'es');
    if (paper.paper === 'speaking') return;

    // La clave de respuestas da la nota máxima, que es la del examen de verdad.
    const format = EXAM_FORMATS[paper.level][paper.paper];
    const result = gradeExamPaper(paper, allCorrect(paper));
    expect(result.marks).toBe(result.total);
    expect(result.total).toBe(
      format.parts.reduce(
        (sum, part) => sum + (part.type === 'writing' ? 0 : part.questions * part.marksEach),
        0,
      ),
    );

    // Lo que viaja al navegador no lleva respuestas, explicaciones ni guiones.
    const sent = JSON.stringify(toPublicPaper(paper));
    for (const secret of ['explanation_es', '"answer"', '"accept"', '"segments"', 'model_answer']) {
      expect(sent).not.toContain(secret);
    }
    expect(toPublicPaper(paper).parts.flatMap((part) => part.rubric)).toHaveLength(
      paper.parts.length,
    );
    expect(paper.parts.flatMap(partNumbers).length).toBeGreaterThan(0);
  });
});

describe('isAnswered', () => {
  it('una opción elegida cuenta aunque sea la primera (índice 0)', () => {
    expect(isAnswered(0)).toBe(true);
    expect(isAnswered('B')).toBe(true);
    expect(isAnswered('  ')).toBe(false);
    expect(isAnswered('')).toBe(false);
    expect(isAnswered(undefined)).toBe(false);
  });
});

describe('gradeSpeaking', () => {
  const b2 = EXAM_FORMATS.B2;

  it('aplica los pesos del examen: 60 puntos en el B2 First', () => {
    const result = gradeSpeaking(b2, {
      grammar_vocabulary: 5,
      discourse_management: 5,
      pronunciation: 5,
      interactive_communication: 5,
      global_achievement: 5,
    });
    expect(result).toMatchObject({ marks: 60, total: 60, scale: 190, band: 'grade_a' });
  });

  it('con un 3 en todo se aprueba justo', () => {
    const result = gradeSpeaking(b2, {
      grammar_vocabulary: 3,
      discourse_management: 3,
      pronunciation: 3,
      interactive_communication: 3,
      global_achievement: 3,
    });
    // (3 × 2) × 4 + 3 × 4 = 36 → 160.
    expect(result).toMatchObject({ marks: 36, scale: 160, band: 'grade_c', passed: true });
  });

  it('usa los criterios de cada examen', () => {
    expect(
      gradeSpeaking(EXAM_FORMATS.C1, {
        grammatical_resource: 4,
        lexical_resource: 4,
        discourse_management: 4,
        pronunciation: 4,
        interactive_communication: 4,
        global_achievement: 4,
      }),
    ).toMatchObject({ marks: 60, total: 75 });
    expect(
      gradeSpeaking(EXAM_FORMATS.B1, {
        grammar_vocabulary: 3,
        discourse_management: 3,
        pronunciation: 3,
        interactive_communication: 3,
        global_achievement: 3,
      }),
    ).toMatchObject({ marks: 18, total: 30, scale: 140 });
  });

  it('sin escala (A1) aprueba con el 60 %', () => {
    const ratings = { grammar_vocabulary: 3, pronunciation: 3, interactive_communication: 3 };
    expect(gradeSpeaking(EXAM_FORMATS.A1, { ...ratings, global_achievement: 3 })).toMatchObject({
      marks: 27,
      total: 45,
      scale: null,
      band: null,
      passed: true,
    });
    expect(gradeSpeaking(EXAM_FORMATS.A1, { ...ratings, global_achievement: 2 })?.passed).toBe(
      false,
    );
  });

  it('no puntúa si falta un criterio o la nota no es válida', () => {
    expect(gradeSpeaking(b2, { grammar_vocabulary: 3 })).toBeNull();
    expect(
      gradeSpeaking(b2, {
        grammar_vocabulary: 6,
        discourse_management: 3,
        pronunciation: 3,
        interactive_communication: 3,
        global_achievement: 3,
      }),
    ).toBeNull();
  });
});
