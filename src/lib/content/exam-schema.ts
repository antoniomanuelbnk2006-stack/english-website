import { z } from 'zod';
import {
  EXAM_FORMATS,
  SPEAKING_KINDS,
  type ExamFormat,
  type ExamPaperKind,
  type PartFormat,
} from './exam-formats';
import { helpText, type Localized } from './help';
import { DASH_PREFIX, withoutLanguage } from './language';
import { Cefr, Speaker } from './schema';
import { countExamWords, fullAnswers, gapNumbers } from './uoe-schema';

// Simulacros de examen de Cambridge (docs/adr/0017-simulacros-de-examen.md). Cada prueba
// (Reading, Listening o Speaking) es un fichero `content/exams/{nivel}/{id}.json` con las partes
// y el número de preguntas del examen oficial (`exam-formats.ts`). Textos y guiones originales:
// nada copiado de exámenes reales.

export const ExamPaperId = z
  .string()
  .regex(new RegExp(`^${DASH_PREFIX}(a1|a2|b1|b2|c1|c2)-exam-\\d{2}-(reading|listening|speaking)$`));

/** Letra de una opción en las partes de emparejar y de texto con huecos. */
const Letter = z.string().regex(/^[A-H]$/);
const Explanation = helpText();
/** Las instrucciones de la parte, en inglés, como en el cuadernillo. */
const Rubric = z.string().min(1);
const QuestionNumber = z.number().int().positive().max(60);

/** Una grabación del Listening: quién habla y qué dice. El audio lo añade el pipeline. */
export const ExamRecording = z.object({
  id: z.string().regex(/^r\d{2}$/),
  speakers: z.array(Speaker).min(1).max(6),
  segments: z
    .array(
      z.object({
        speaker: z.string().min(1),
        text: z.string().min(1),
        pause_after_ms: z.number().int().nonnegative().optional(),
      }),
    )
    .min(1),
  audio: z.object({ src: z.string().min(1), duration_s: z.number().positive() }).optional(),
});
export type RawExamRecording = z.infer<typeof ExamRecording>;
export type ExamRecording = Localized<RawExamRecording>;

const Choice = z.object({
  n: QuestionNumber,
  /** La pregunta. Puede faltar cuando las opciones lo dicen todo (¿qué significa el cartel?). */
  prompt: z.string().min(1).optional(),
  options: z.array(z.string().min(1)).min(3).max(4),
  /** Índice de la opción correcta (0 = A). */
  answer: z.number().int().min(0).max(3),
  explanation_es: Explanation,
});

/** Preguntas de elegir sobre un texto largo, varios textos cortos o varias grabaciones. */
const McqPart = z.object({
  type: z.literal('mcq'),
  rubric: Rubric,
  title: z.string().min(1).optional(),
  groups: z
    .array(
      z.object({
        /** Reading: el texto (los párrafos, separados por una línea en blanco). */
        text: z.string().min(1).optional(),
        /** Listening: la situación que el candidato lee («You hear two friends…»). */
        context: z.string().min(1).optional(),
        recording: ExamRecording.optional(),
        questions: z.array(Choice).min(1),
      }),
    )
    .min(1),
});

const McqClozePart = z.object({
  type: z.literal('mcq_cloze'),
  rubric: Rubric,
  title: z.string().min(1),
  /** Texto con los huecos marcados `{{1}}`, `{{2}}`… con el número de la pregunta. */
  text: z.string().min(1),
  gaps: z
    .array(
      z.object({
        n: QuestionNumber,
        options: z.array(z.string().min(1)).min(3).max(4),
        answer: z.number().int().min(0).max(3),
        explanation_es: Explanation,
      }),
    )
    .min(1),
});

const OpenClozePart = z.object({
  type: z.literal('open_cloze'),
  rubric: Rubric,
  title: z.string().min(1),
  text: z.string().min(1),
  gaps: z
    .array(
      z.object({
        n: QuestionNumber,
        accept: z.array(z.string().min(1)).min(1),
        explanation_es: Explanation,
      }),
    )
    .min(1),
});

const WordFormationPart = z.object({
  type: z.literal('word_formation'),
  rubric: Rubric,
  title: z.string().min(1),
  text: z.string().min(1),
  gaps: z
    .array(
      z.object({
        n: QuestionNumber,
        stem: z.string().regex(/^[A-Z]+$/),
        accept: z.array(z.string().min(1)).min(1),
        explanation_es: Explanation,
      }),
    )
    .min(1),
});

const TransformationPart = z.object({
  type: z.literal('key_word_transformation'),
  rubric: Rubric,
  items: z
    .array(
      z.object({
        n: QuestionNumber,
        original: z.string().min(1),
        keyword: z.string().regex(/^[A-Z']+$/),
        before: z.string(),
        after: z.string(),
        parts: z.tuple([
          z.array(z.string().min(1)).min(1),
          z.array(z.string().min(1)).min(1),
        ]),
        explanation_es: Explanation,
      }),
    )
    .min(1),
});

/** Texto al que se le han quitado frases o párrafos: hay que devolver cada uno a su hueco. */
const GappedTextPart = z.object({
  type: z.literal('gapped_text'),
  rubric: Rubric,
  title: z.string().min(1),
  text: z.string().min(1),
  options: z.array(z.object({ id: Letter, text: z.string().min(1) })).min(3),
  gaps: z.array(z.object({ n: QuestionNumber, answer: Letter, explanation_es: Explanation })).min(1),
});

/** Emparejar preguntas con textos (Reading) o hablantes con afirmaciones (Listening). */
const MatchingPart = z.object({
  type: z.literal('matching'),
  rubric: Rubric,
  title: z.string().min(1).optional(),
  recording: ExamRecording.optional(),
  tasks: z
    .array(
      z.object({
        /** «Task One: For questions 21–25, choose from the list (A–H)…» */
        heading: z.string().min(1).optional(),
        options: z
          .array(
            z.object({ id: Letter, title: z.string().min(1).optional(), text: z.string().min(1) }),
          )
          .min(3),
        questions: z
          .array(
            z.object({
              n: QuestionNumber,
              prompt: z.string().min(1),
              answer: Letter,
              explanation_es: Explanation,
            }),
          )
          .min(1),
      }),
    )
    .min(1)
    .max(2),
});

/** Listening: completar frases o notas con lo que se oye. */
const CompletionPart = z.object({
  type: z.literal('completion'),
  rubric: Rubric,
  title: z.string().min(1).optional(),
  /** Las frases o notas, una por línea, con los huecos `{{9}}`, `{{10}}`… */
  text: z.string().min(1),
  gaps: z
    .array(
      z.object({
        n: QuestionNumber,
        accept: z.array(z.string().min(1)).min(1),
        explanation_es: Explanation,
      }),
    )
    .min(1),
  recording: ExamRecording,
});

/** Redacción breve del A2 Key: no se puntúa sola; se compara con el modelo. */
const WritingPart = z.object({
  type: z.literal('writing'),
  rubric: Rubric,
  n: QuestionNumber,
  prompt: z.string().min(1),
  min_words: z.number().int().positive(),
  model_answer: z.string().min(1),
  checklist_es: z.array(helpText()).min(2),
});

export const ExamPart = z.discriminatedUnion('type', [
  McqPart,
  McqClozePart,
  OpenClozePart,
  WordFormationPart,
  TransformationPart,
  GappedTextPart,
  MatchingPart,
  CompletionPart,
  WritingPart,
]);
export type RawExamPart = z.infer<typeof ExamPart>;
export type ExamPart = Localized<RawExamPart>;

const PaperBase = z.object({
  id: ExamPaperId,
  version: z.number().int().positive(),
  status: z.enum(['draft', 'published']),
  level: Cefr,
  provenance: z.object({
    origin: z.enum(['human', 'ai']),
    model: z.string().optional(),
    created_at: z.string(),
    reviewed_by: z.string().optional(),
  }),
});

export const QuestionPaper = PaperBase.extend({
  paper: z.enum(['reading', 'listening']),
  parts: z.array(ExamPart).min(1),
});
export type RawQuestionPaper = z.infer<typeof QuestionPaper>;
export type QuestionPaper = Localized<RawQuestionPaper>;

// ───────────── Speaking ─────────────

const SpeakingTurn = z.object({
  /** Lo que dice el examinador: se oye y se puede leer. */
  examiner: z.string().min(1),
  /** Lo que el candidato tiene escrito delante (la pregunta impresa de las partes 2 y 3). */
  shown: z.string().min(1).optional(),
  /** Las fotos, descritas (no hay imágenes). */
  visuals: z
    .array(z.object({ label: z.string().min(1), description: z.string().min(1) }))
    .min(1)
    .max(4)
    .optional(),
  /** Las ideas del diagrama de la tarea colaborativa. */
  prompts: z.array(z.string().min(1)).min(2).max(6).optional(),
  /** Segundos para mirar el material antes de hablar. */
  prep_s: z.number().int().positive().max(60).optional(),
  /** Segundos para responder. */
  answer_s: z.number().int().min(10).max(180),
});

const SpeakingPart = z.object({
  kind: z.enum(SPEAKING_KINDS),
  /** Qué pasa en esta parte y qué se valora, en español. */
  about_es: helpText(),
  turns: z.array(SpeakingTurn).min(1),
  /** Expresiones útiles para esta parte; se enseñan al terminar. */
  useful_language: z.array(z.string().min(1)).min(3),
  tips_es: z.array(helpText()).min(1),
});
export type RawSpeakingPart = z.infer<typeof SpeakingPart>;
export type SpeakingPart = Localized<RawSpeakingPart>;

export const SpeakingPaper = PaperBase.extend({
  paper: z.literal('speaking'),
  parts: z.array(SpeakingPart).min(1),
});
export type RawSpeakingPaper = z.infer<typeof SpeakingPaper>;
export type SpeakingPaper = Localized<RawSpeakingPaper>;

export const ExamPaper = z.discriminatedUnion('paper', [
  QuestionPaper.extend({ paper: z.literal('reading') }),
  QuestionPaper.extend({ paper: z.literal('listening') }),
  SpeakingPaper,
]);
export type RawExamPaper = z.infer<typeof ExamPaper>;
export type ExamPaper = Localized<RawExamPaper>;

/** `b2-exam-01-reading` (o `es-b2-exam-01-reading`) → nivel, número de simulacro y prueba. */
export function parsePaperId(id: string): { level: string; test: number; paper: ExamPaperKind } | null {
  const match = /^(a1|a2|b1|b2|c1|c2)-exam-(\d{2})-(reading|listening|speaking)$/.exec(
    withoutLanguage(id),
  );
  if (!match?.[1] || !match[2] || !match[3]) return null;
  return { level: match[1], test: Number(match[2]), paper: match[3] as ExamPaperKind };
}

/** Números de pregunta de una parte, en orden. */
export function partNumbers(part: RawExamPart): number[] {
  switch (part.type) {
    case 'mcq':
      return part.groups.flatMap((group) => group.questions.map((question) => question.n));
    case 'key_word_transformation':
      return part.items.map((item) => item.n);
    case 'matching':
      return part.tasks.flatMap((task) => task.questions.map((question) => question.n));
    case 'writing':
      return [part.n];
    default:
      return part.gaps.map((gap) => gap.n);
  }
}

/** Las grabaciones de una parte del Listening, en el orden en que suenan. */
export function partRecordings(part: RawExamPart): RawExamRecording[] {
  if (part.type === 'mcq') return part.groups.flatMap((group) => group.recording ?? []);
  if (part.type === 'matching') return part.recording ? [part.recording] : [];
  if (part.type === 'completion') return [part.recording];
  return [];
}

const fold = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();
const LETTERS = 'ABCDEFGH';

function checkLetters(ids: readonly string[], where: string, issues: string[]): void {
  if (ids.join('') !== LETTERS.slice(0, ids.length)) {
    issues.push(`${where}: las opciones deben ir en orden A, B, C… (hay ${ids.join(', ')})`);
  }
}

function checkPart(
  part: RawExamPart,
  format: PartFormat,
  where: string,
  listening: boolean,
): string[] {
  const issues: string[] = [];
  const say = (text: string) => issues.push(`${where}: ${text}`);

  if (part.type !== format.type) {
    say(`es de tipo «${part.type}» y el examen pide «${format.type}»`);
    return issues;
  }
  const numbers = partNumbers(part);
  if (numbers.length !== format.questions) {
    say(`tiene ${numbers.length} preguntas y el examen tiene ${format.questions}`);
  }

  const recordings = partRecordings(part);
  if (listening && recordings.length === 0) say('falta la grabación');
  if (!listening && recordings.length > 0) say('una parte de Reading no lleva grabación');
  for (const recording of recordings) {
    const known = new Set(recording.speakers.map((speaker) => speaker.id));
    for (const segment of recording.segments) {
      if (!known.has(segment.speaker)) {
        say(`grabación ${recording.id}: «${segment.speaker}» no está entre los hablantes`);
      }
    }
  }

  switch (part.type) {
    case 'mcq': {
      for (const group of part.groups) {
        if (listening ? !group.recording : !group.text) {
          say(listening ? 'hay un grupo sin grabación' : 'hay un grupo sin texto');
        }
        for (const question of group.questions) {
          if (format.options && question.options.length !== format.options) {
            say(`pregunta ${question.n}: tiene ${question.options.length} opciones y el examen ${format.options}`);
          }
          if (question.answer >= question.options.length) say(`pregunta ${question.n}: la respuesta no existe`);
          if (new Set(question.options.map(fold)).size !== question.options.length) {
            say(`pregunta ${question.n}: hay opciones repetidas`);
          }
        }
      }
      break;
    }
    case 'mcq_cloze':
    case 'open_cloze':
    case 'word_formation':
    case 'completion': {
      const inText = gapNumbers(part.text);
      if (inText.join() !== numbers.join()) {
        say(`los huecos del texto (${inText.join(', ')}) no coinciden con las preguntas (${numbers.join(', ')})`);
      }
      if (part.type === 'mcq_cloze') {
        for (const gap of part.gaps) {
          if (format.options && gap.options.length !== format.options) {
            say(`hueco ${gap.n}: tiene ${gap.options.length} opciones y el examen ${format.options}`);
          }
          if (gap.answer >= gap.options.length) say(`hueco ${gap.n}: la respuesta no existe`);
          if (new Set(gap.options.map(fold)).size !== gap.options.length) {
            say(`hueco ${gap.n}: hay opciones repetidas`);
          }
        }
      } else if (part.type === 'open_cloze') {
        for (const gap of part.gaps) {
          const long = gap.accept.filter((answer) => fold(answer).includes(' '));
          if (long.length > 0) say(`hueco ${gap.n}: «${long.join('», «')}» no es una sola palabra`);
        }
      } else if (part.type === 'word_formation') {
        for (const gap of part.gaps) {
          if (gap.accept.some((answer) => fold(answer) === gap.stem.toLowerCase())) {
            say(`hueco ${gap.n}: la respuesta es la palabra dada sin cambiar`);
          }
        }
      } else {
        for (const gap of part.gaps) {
          const long = gap.accept.filter((answer) => fold(answer).split(' ').length > 3);
          if (long.length > 0) say(`hueco ${gap.n}: «${long.join('», «')}» pasa de tres palabras`);
        }
      }
      break;
    }
    case 'key_word_transformation': {
      const [min, max] = format.words ?? [2, 5];
      for (const item of part.items) {
        const keyword = item.keyword.toLowerCase();
        for (const answer of fullAnswers(item)) {
          if (!fold(answer).split(' ').includes(keyword)) {
            say(`frase ${item.n}: «${answer}» no contiene la palabra dada ${item.keyword}`);
          }
          const count = countExamWords(answer);
          if (count < min || count > max) {
            say(`frase ${item.n}: «${answer}» tiene ${count} palabras (límite ${min}–${max})`);
          }
        }
        if (item.parts.some((half) => half.some((text) => fold(text) === keyword))) {
          say(`frase ${item.n}: una mitad es solo la palabra dada (ese punto se regalaría)`);
        }
        if (fold(item.original).split(/[^a-z']+/).includes(keyword)) {
          say(`frase ${item.n}: la frase original ya contiene la palabra dada`);
        }
      }
      break;
    }
    case 'gapped_text': {
      const inText = gapNumbers(part.text);
      if (inText.join() !== numbers.join()) {
        say(`los huecos del texto (${inText.join(', ')}) no coinciden con las preguntas (${numbers.join(', ')})`);
      }
      const ids = part.options.map((option) => option.id);
      checkLetters(ids, where, issues);
      if (format.choices && ids.length !== format.choices) {
        say(`tiene ${ids.length} opciones y el examen ${format.choices}`);
      }
      const used = part.gaps.map((gap) => gap.answer);
      if (used.some((answer) => !ids.includes(answer))) say('hay una respuesta que no es una opción');
      if (new Set(used).size !== used.length) say('una opción se usa en dos huecos');
      break;
    }
    case 'matching': {
      if (part.tasks.length !== (format.tasks ?? 1)) {
        say(`tiene ${part.tasks.length} tareas y el examen ${format.tasks ?? 1}`);
      }
      for (const task of part.tasks) {
        const ids = task.options.map((option) => option.id);
        checkLetters(ids, where, issues);
        if (format.choices && ids.length !== format.choices) {
          say(`una tarea tiene ${ids.length} opciones y el examen ${format.choices}`);
        }
        for (const question of task.questions) {
          if (!ids.includes(question.answer)) say(`pregunta ${question.n}: la respuesta no es una opción`);
        }
        // Con hablantes, cada afirmación vale para uno solo; con textos, un texto se repite.
        if (listening) {
          const used = task.questions.map((question) => question.answer);
          if (new Set(used).size !== used.length) say('una opción se usa con dos hablantes');
        }
      }
      break;
    }
    case 'writing':
      break;
  }
  return issues;
}

/** Comprobaciones que el esquema no puede expresar. Devuelve los problemas encontrados. */
export function checkExamPaper(
  paper: RawExamPaper,
  expected: { id: string; level: string },
): string[] {
  const issues: string[] = [];
  if (paper.id !== expected.id) issues.push(`el id «${paper.id}» no coincide con el fichero`);
  if (paper.level.toLowerCase() !== expected.level) {
    issues.push(`el nivel ${paper.level} no coincide con la carpeta ${expected.level}`);
  }
  const parsed = parsePaperId(paper.id);
  if (parsed?.level !== paper.level.toLowerCase()) {
    issues.push(`el id debe empezar por «${paper.level.toLowerCase()}-»`);
  }
  if (parsed?.paper !== paper.paper) issues.push(`el id debe terminar en «-${paper.paper}»`);

  const format: ExamFormat = EXAM_FORMATS[paper.level];

  if (paper.paper === 'speaking') {
    const kinds = format.speaking.parts.map((part) => part.kind);
    const own = paper.parts.map((part) => part.kind);
    if (own.join() !== kinds.join()) {
      issues.push(`las partes (${own.join(', ')}) no son las del examen (${kinds.join(', ')})`);
    }
    return issues;
  }

  const formats = format[paper.paper].parts;
  if (paper.parts.length !== formats.length) {
    issues.push(`tiene ${paper.parts.length} partes y el examen tiene ${formats.length}`);
    return issues;
  }
  paper.parts.forEach((part, index) => {
    const partFormat = formats[index];
    if (!partFormat) return;
    issues.push(...checkPart(part, partFormat, `parte ${index + 1}`, paper.paper === 'listening'));
  });

  // Como en el cuadernillo: las preguntas se numeran de corrido de principio a fin.
  const numbers = paper.parts.flatMap(partNumbers);
  if (numbers.some((n, index) => n !== index + 1)) {
    issues.push(`las preguntas se numeran de corrido 1, 2, 3… (hay ${numbers.join(', ')})`);
  }
  const recordingIds = paper.parts.flatMap(partRecordings).map((recording) => recording.id);
  if (new Set(recordingIds).size !== recordingIds.length) {
    issues.push('hay dos grabaciones con el mismo id');
  }
  return issues;
}

// ───────────── Lo que ve el navegador antes de entregar ─────────────

export interface PublicRecording {
  id: string;
  src: string | null;
  duration_s: number;
}

interface PublicChoice {
  n: number;
  prompt?: string;
  options: string[];
}

export type PublicExamPart =
  | {
      type: 'mcq';
      rubric: string;
      title?: string;
      groups: {
        text?: string;
        context?: string;
        recording?: PublicRecording;
        questions: PublicChoice[];
      }[];
    }
  | {
      type: 'mcq_cloze';
      rubric: string;
      title: string;
      text: string;
      gaps: { n: number; options: string[] }[];
    }
  | { type: 'open_cloze'; rubric: string; title: string; text: string; gaps: { n: number }[] }
  | {
      type: 'word_formation';
      rubric: string;
      title: string;
      text: string;
      gaps: { n: number; stem: string }[];
    }
  | {
      type: 'key_word_transformation';
      rubric: string;
      items: { n: number; original: string; keyword: string; before: string; after: string }[];
    }
  | {
      type: 'gapped_text';
      rubric: string;
      title: string;
      text: string;
      options: { id: string; text: string }[];
      gaps: { n: number }[];
    }
  | {
      type: 'matching';
      rubric: string;
      title?: string;
      recording?: PublicRecording;
      tasks: {
        heading?: string;
        options: { id: string; title?: string; text: string }[];
        questions: { n: number; prompt: string }[];
      }[];
    }
  | {
      type: 'completion';
      rubric: string;
      title?: string;
      text: string;
      gaps: { n: number }[];
      recording: PublicRecording;
    }
  | { type: 'writing'; rubric: string; n: number; prompt: string; min_words: number };

export interface PublicQuestionPaper {
  id: string;
  version: number;
  level: z.infer<typeof Cefr>;
  paper: 'reading' | 'listening';
  parts: PublicExamPart[];
}

/** De la grabación solo viajan el audio y su duración: el guion se queda en el servidor. */
function toPublicRecording(recording: ExamRecording): PublicRecording {
  return {
    id: recording.id,
    src: recording.audio?.src ?? null,
    duration_s: recording.audio?.duration_s ?? 0,
  };
}

function toPublicPart(part: ExamPart): PublicExamPart {
  switch (part.type) {
    case 'mcq':
      return {
        type: part.type,
        rubric: part.rubric,
        ...(part.title ? { title: part.title } : {}),
        groups: part.groups.map((group) => ({
          ...(group.text ? { text: group.text } : {}),
          ...(group.context ? { context: group.context } : {}),
          ...(group.recording ? { recording: toPublicRecording(group.recording) } : {}),
          questions: group.questions.map(({ n, prompt, options }) => ({
            n,
            ...(prompt ? { prompt } : {}),
            options,
          })),
        })),
      };
    case 'mcq_cloze':
      return {
        type: part.type,
        rubric: part.rubric,
        title: part.title,
        text: part.text,
        gaps: part.gaps.map(({ n, options }) => ({ n, options })),
      };
    case 'open_cloze':
      return {
        type: part.type,
        rubric: part.rubric,
        title: part.title,
        text: part.text,
        gaps: part.gaps.map(({ n }) => ({ n })),
      };
    case 'word_formation':
      return {
        type: part.type,
        rubric: part.rubric,
        title: part.title,
        text: part.text,
        gaps: part.gaps.map(({ n, stem }) => ({ n, stem })),
      };
    case 'key_word_transformation':
      return {
        type: part.type,
        rubric: part.rubric,
        items: part.items.map(({ n, original, keyword, before, after }) => ({
          n,
          original,
          keyword,
          before,
          after,
        })),
      };
    case 'gapped_text':
      return {
        type: part.type,
        rubric: part.rubric,
        title: part.title,
        text: part.text,
        options: part.options,
        gaps: part.gaps.map(({ n }) => ({ n })),
      };
    case 'matching':
      return {
        type: part.type,
        rubric: part.rubric,
        ...(part.title ? { title: part.title } : {}),
        ...(part.recording ? { recording: toPublicRecording(part.recording) } : {}),
        tasks: part.tasks.map((task) => ({
          ...(task.heading ? { heading: task.heading } : {}),
          options: task.options,
          questions: task.questions.map(({ n, prompt }) => ({ n, prompt })),
        })),
      };
    case 'completion':
      return {
        type: part.type,
        rubric: part.rubric,
        ...(part.title ? { title: part.title } : {}),
        text: part.text,
        gaps: part.gaps.map(({ n }) => ({ n })),
        recording: toPublicRecording(part.recording),
      };
    case 'writing':
      return {
        type: part.type,
        rubric: part.rubric,
        n: part.n,
        prompt: part.prompt,
        min_words: part.min_words,
      };
  }
}

/**
 * La prueba sin respuestas, explicaciones ni guiones de las grabaciones: todo eso se queda en
 * el servidor hasta que se entrega.
 */
export function toPublicPaper(paper: QuestionPaper): PublicQuestionPaper {
  return {
    id: paper.id,
    version: paper.version,
    level: paper.level,
    paper: paper.paper,
    parts: paper.parts.map(toPublicPart),
  };
}
