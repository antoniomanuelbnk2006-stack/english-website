import { matchesAny } from '@/features/tasks/lib/grade';
import { gradeTransformation, type UoeNote } from '@/features/use-of-english/lib/grade';
import {
  EXAM_FORMATS,
  SPEAKING_CRITERIA,
  speakingMarks,
  type ExamFormat,
  type ExamPartType,
  type ExamSection,
  type PartFormat,
  type SpeakingCriterion,
} from '@/lib/content/exam-formats';
import type { ExamPart, QuestionPaper } from '@/lib/content/exam-schema';
import { PASS_RATIO, isPass, scaleBand, toScale, type ScaleBand } from './scale';

// Corrección de una prueba de Reading o de Listening con los puntos del examen: uno o dos por
// pregunta según la parte y, en las transformaciones, uno por cada mitad. Lógica pura.

/** Respuestas por número de pregunta: texto, letra (A–H) o índice de la opción elegida. */
export type ExamAnswers = Readonly<Record<number, string | number | undefined>>;

export interface ExamItemResult {
  n: number;
  marks: number;
  max: number;
  correct: boolean;
  /** Lo que se respondió, listo para enseñar («B. a lot of»). Vacío si se dejó en blanco. */
  given: string;
  answer: string;
  explanation_es: string;
  note?: UoeNote;
}

export interface ExamPartResult {
  /** Número de la parte (1, 2…). */
  part: number;
  type: ExamPartType;
  name: string;
  section: ExamSection;
  marks: number;
  total: number;
  items: ExamItemResult[];
}

export interface ExamSectionResult {
  section: ExamSection;
  marks: number;
  total: number;
  /** Nota orientativa en la escala Cambridge; `null` si no llega al mínimo o no hay escala. */
  scale: number | null;
  band: ScaleBand | null;
  passed: boolean;
}

export interface ExamResult {
  parts: ExamPartResult[];
  sections: ExamSectionResult[];
  marks: number;
  total: number;
  /** De 0 a 1. */
  score: number;
  answered: number;
  questions: number;
}

const LETTERS = ['A', 'B', 'C', 'D'];
const lettered = (options: readonly string[], index: number) =>
  options[index] === undefined ? '' : `${LETTERS[index]}. ${options[index]}`;

/** ¿Se ha respondido algo a esta pregunta? */
export function isAnswered(value: string | number | undefined): value is string | number {
  return typeof value === 'number' || (typeof value === 'string' && value.trim() !== '');
}

function gradeChoice(
  question: { n: number; options: string[]; answer: number; explanation_es: string },
  answers: ExamAnswers,
  max: number,
): ExamItemResult {
  const chosen = answers[question.n];
  const index = typeof chosen === 'number' ? chosen : -1;
  const correct = index === question.answer;
  return {
    n: question.n,
    marks: correct ? max : 0,
    max,
    correct,
    given: lettered(question.options, index),
    answer: lettered(question.options, question.answer),
    explanation_es: question.explanation_es,
  };
}

function gradeLetter(
  question: { n: number; answer: string; explanation_es: string },
  answers: ExamAnswers,
  max: number,
): ExamItemResult {
  const given = String(answers[question.n] ?? '')
    .trim()
    .toUpperCase();
  const correct = given === question.answer;
  return {
    n: question.n,
    marks: correct ? max : 0,
    max,
    correct,
    given,
    answer: question.answer,
    explanation_es: question.explanation_es,
  };
}

function gradeText(
  gap: { n: number; accept: string[]; explanation_es: string },
  answers: ExamAnswers,
  max: number,
): ExamItemResult {
  const given = String(answers[gap.n] ?? '').trim();
  const correct = matchesAny(given, gap.accept);
  return {
    n: gap.n,
    marks: correct ? max : 0,
    max,
    correct,
    given,
    answer: gap.accept[0] ?? '',
    explanation_es: gap.explanation_es,
  };
}

function gradePart(part: ExamPart, format: PartFormat, answers: ExamAnswers): ExamItemResult[] {
  const max = format.marksEach;
  switch (part.type) {
    case 'mcq':
      return part.groups.flatMap((group) =>
        group.questions.map((question) => gradeChoice(question, answers, max)),
      );
    case 'mcq_cloze':
      return part.gaps.map((gap) => gradeChoice(gap, answers, max));
    case 'open_cloze':
    case 'word_formation':
    case 'completion':
      return part.gaps.map((gap) => gradeText(gap, answers, max));
    case 'gapped_text':
      return part.gaps.map((gap) => gradeLetter(gap, answers, max));
    case 'matching':
      return part.tasks.flatMap((task) =>
        task.questions.map((question) => gradeLetter(question, answers, max)),
      );
    case 'key_word_transformation': {
      const [min, maxWords] = format.words ?? [2, 5];
      return part.items.map((item) => {
        const given = String(answers[item.n] ?? '').trim();
        const { marks, note } = gradeTransformation(given, item, { min, max: maxWords });
        return {
          n: item.n,
          marks,
          max: 2,
          correct: marks === 2,
          given,
          answer: `${item.parts[0][0]} ${item.parts[1][0]}`,
          explanation_es: item.explanation_es,
          ...(note ? { note } : {}),
        };
      });
    }
    // Las redacciones del A2 Key no se puntúan solas.
    case 'writing':
      return [];
  }
}

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

function sectionResult(
  format: ExamFormat,
  paper: 'reading' | 'listening',
  section: ExamSection,
  marks: number,
  total: number,
): ExamSectionResult {
  const table = format[paper].scale[section];
  if (!table || format.pass === null) {
    const passed = total > 0 && marks / total >= PASS_RATIO;
    return { section, marks, total, scale: null, band: null, passed };
  }
  const scale = toScale(table, marks, format.pass);
  const band = scaleBand(scale, format.pass);
  return { section, marks, total, scale, band, passed: isPass(band) };
}

export function gradeExamPaper(paper: QuestionPaper, answers: ExamAnswers): ExamResult {
  const format = EXAM_FORMATS[paper.level];
  const formats = format[paper.paper].parts;

  const parts: ExamPartResult[] = paper.parts.flatMap((part, index) => {
    const partFormat = formats[index];
    if (!partFormat || part.type === 'writing') return [];
    const items = gradePart(part, partFormat, answers);
    return [
      {
        part: index + 1,
        type: part.type,
        name: partFormat.name,
        section: partFormat.section,
        marks: sum(items.map((item) => item.marks)),
        total: sum(items.map((item) => item.max)),
        items,
      },
    ];
  });

  const sections = [...new Set(parts.map((part) => part.section))].map((section) => {
    const own = parts.filter((part) => part.section === section);
    return sectionResult(
      format,
      paper.paper,
      section,
      sum(own.map((part) => part.marks)),
      sum(own.map((part) => part.total)),
    );
  });

  const marks = sum(parts.map((part) => part.marks));
  const total = sum(parts.map((part) => part.total));
  const items = parts.flatMap((part) => part.items);
  return {
    parts,
    sections,
    marks,
    total,
    score: total === 0 ? 0 : marks / total,
    answered: items.filter((item) => item.given !== '').length,
    questions: items.length,
  };
}

// ───────────── Speaking: autoevaluación con los criterios del examinador ─────────────

export type SpeakingRatings = Partial<Record<SpeakingCriterion, number>>;

export interface SpeakingResult {
  criteria: { key: SpeakingCriterion; rating: number; weight: number }[];
  marks: number;
  total: number;
  score: number;
  scale: number | null;
  band: ScaleBand | null;
  passed: boolean;
}

/** `null` si falta algún criterio del examen o alguna nota no está entre 0 y 5. */
export function gradeSpeaking(format: ExamFormat, ratings: SpeakingRatings): SpeakingResult | null {
  const criteria = [];
  for (const { key, weight } of format.speaking.criteria) {
    const rating = ratings[key];
    if (rating === undefined || rating < 0 || rating > 5) return null;
    criteria.push({ key, rating, weight });
  }
  const marks = sum(criteria.map((criterion) => criterion.rating * criterion.weight));
  const total = speakingMarks(format);
  const table = format.speaking.scale;
  if (!table || format.pass === null) {
    return {
      criteria,
      marks,
      total,
      score: marks / total,
      scale: null,
      band: null,
      passed: marks / total >= PASS_RATIO,
    };
  }
  const scale = toScale(table, marks, format.pass);
  const band = scaleBand(scale, format.pass);
  return { criteria, marks, total, score: marks / total, scale, band, passed: isPass(band) };
}

export const isSpeakingCriterion = (value: string): value is SpeakingCriterion =>
  (SPEAKING_CRITERIA as readonly string[]).includes(value);
