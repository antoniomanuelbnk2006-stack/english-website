// Formato de los exámenes por idioma y nivel: pruebas, partes, número de preguntas, puntos y
// tiempo. Datos puros, sin contenido.
// - Inglés: los de Cambridge (docs/adr/0017-simulacros-de-examen.md), de la página «Exam format»
//   de cada examen en cambridgeenglish.org; la conversión a la escala Cambridge, de su guía
//   «Converting practice test scores to Cambridge English Scale scores» (2023).
// - Español: los del DELE del Instituto Cervantes (docs/adr/0040-examenes-de-espanol.md), con la
//   estructura publicada de cada nivel (pruebas, tareas, ítems y tiempos). El reparto exacto de
//   ítems por tarea es orientativo.
import type { PracticeLanguage } from './language';

export const EXAM_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type ExamLevel = (typeof EXAM_LEVELS)[number];

export const EXAM_PAPERS = ['reading', 'listening', 'speaking'] as const;
export type ExamPaperKind = (typeof EXAM_PAPERS)[number];

export const EXAM_PART_TYPES = [
  'mcq',
  'mcq_cloze',
  'open_cloze',
  'word_formation',
  'key_word_transformation',
  'gapped_text',
  'matching',
  'completion',
  'writing',
] as const;
export type ExamPartType = (typeof EXAM_PART_TYPES)[number];

/** Secciones que Cambridge puntúa por separado. */
export type ExamSection = 'reading' | 'use_of_english' | 'listening' | 'writing';

export interface PartFormat {
  type: ExamPartType;
  /** Nombre oficial de la tarea, en inglés. */
  name: string;
  questions: number;
  marksEach: 1 | 2;
  section: ExamSection;
  /** Opciones por pregunta en las partes de elegir. */
  options?: 3 | 4;
  /** Textos u opciones entre los que se elige en las partes de emparejar o de texto con huecos. */
  choices?: number;
  /** Tareas de una parte de emparejar (C1 y C2, Listening 4: dos tareas sobre lo mismo). */
  tasks?: number;
  /** Límite de palabras de las transformaciones. */
  words?: readonly [number, number];
  /** Listening: segundos para leer las preguntas antes de la grabación. */
  prepS?: number;
  /** Listening: segundos para leer cada pregunta en las partes de varios extractos. */
  groupPrepS?: number;
}

/** Puntos del simulacro → nota en la escala Cambridge (de más a menos). */
export interface ScaleTable {
  total: number;
  anchors: readonly (readonly [marks: number, scale: number])[];
}

export const SPEAKING_KINDS = ['interview', 'long_turn', 'collaborative', 'discussion'] as const;
export type SpeakingKind = (typeof SPEAKING_KINDS)[number];

export const SPEAKING_CRITERIA = [
  // Cambridge
  'grammar_vocabulary',
  'grammatical_resource',
  'lexical_resource',
  'discourse_management',
  'pronunciation',
  'interactive_communication',
  'global_achievement',
  // DELE: escala analítica (coherencia, fluidez, corrección, alcance) y holística
  'coherence',
  'fluency',
  'accuracy',
  'range',
  'holistic',
] as const;
export type SpeakingCriterion = (typeof SPEAKING_CRITERIA)[number];

/** De quién es el formato: cambia los textos de la pantalla y cómo se aprueba. */
export type ExamSystem = 'cambridge' | 'dele';

export interface ExamFormat {
  system: ExamSystem;
  level: ExamLevel;
  /** Nombre del examen: «B2 First», «DELE B2». */
  exam: string;
  /** `false` en A1 de inglés: Cambridge no tiene examen de A1 para adultos (formato del A2 Key). */
  official: boolean;
  /** Nota de la escala Cambridge con la que se aprueba; `null` si no hay escala (se aprueba con el 60 %). */
  pass: number | null;
  reading: {
    /** Nombre oficial de la prueba. */
    title: string;
    minutes: number;
    parts: readonly PartFormat[];
    scale: Partial<Record<ExamSection, ScaleTable>>;
  };
  listening: {
    title: string;
    /** Duración oficial aproximada («about 40 minutes»). */
    minutes: number;
    /** Segundos al final para revisar las respuestas. */
    reviewS: number;
    parts: readonly PartFormat[];
    scale: Partial<Record<ExamSection, ScaleTable>>;
  };
  speaking: {
    title: string;
    /** Duración oficial de la prueba por pareja de candidatos. */
    minutes: number;
    parts: readonly { kind: SpeakingKind; name: string; minutes: number }[];
    /** Criterios con los que puntúa el examinador (0–5 cada uno) y su peso. */
    criteria: readonly { key: SpeakingCriterion; weight: number }[];
    scale: ScaleTable | null;
  };
  /** La prueba de Writing no se hace aquí: está en «Escribir», con su modo examen. */
  writing: { title: string; minutes: number; tasks: string } | null;
}

const KEY_READING: PartFormat[] = [
  { type: 'mcq', name: 'Multiple choice (short texts)', questions: 6, marksEach: 1, section: 'reading', options: 3 },
  { type: 'matching', name: 'Multiple matching', questions: 7, marksEach: 1, section: 'reading', choices: 3 },
  { type: 'mcq', name: 'Multiple choice (long text)', questions: 5, marksEach: 1, section: 'reading', options: 3 },
  { type: 'mcq_cloze', name: 'Multiple-choice cloze', questions: 6, marksEach: 1, section: 'reading', options: 3 },
  { type: 'open_cloze', name: 'Open cloze', questions: 6, marksEach: 1, section: 'reading' },
  { type: 'writing', name: 'Guided writing (message, 25+ words)', questions: 1, marksEach: 1, section: 'writing' },
  { type: 'writing', name: 'Picture story (35+ words)', questions: 1, marksEach: 1, section: 'writing' },
];

const KEY_LISTENING: PartFormat[] = [
  { type: 'mcq', name: 'Multiple choice (short dialogues)', questions: 5, marksEach: 1, section: 'listening', options: 3, groupPrepS: 8 },
  { type: 'completion', name: 'Gap fill', questions: 5, marksEach: 1, section: 'listening', prepS: 10 },
  { type: 'mcq', name: 'Multiple choice (conversation)', questions: 5, marksEach: 1, section: 'listening', options: 3, prepS: 20 },
  { type: 'mcq', name: 'Multiple choice (main idea)', questions: 5, marksEach: 1, section: 'listening', options: 3, groupPrepS: 8 },
  { type: 'matching', name: 'Matching', questions: 5, marksEach: 1, section: 'listening', choices: 8, prepS: 15 },
];

const KEY_SPEAKING = {
  title: 'Speaking',
  minutes: 10,
  parts: [
    { kind: 'interview', name: 'Interview', minutes: 4 },
    { kind: 'collaborative', name: 'Discussion', minutes: 6 },
  ],
  criteria: [
    { key: 'grammar_vocabulary', weight: 2 },
    { key: 'pronunciation', weight: 2 },
    { key: 'interactive_communication', weight: 2 },
    { key: 'global_achievement', weight: 3 },
  ],
} as const;

const HIGHER_CRITERIA = [
  { key: 'grammatical_resource', weight: 2 },
  { key: 'lexical_resource', weight: 2 },
  { key: 'discourse_management', weight: 2 },
  { key: 'pronunciation', weight: 2 },
  { key: 'interactive_communication', weight: 2 },
  { key: 'global_achievement', weight: 5 },
] as const;

/** Los exámenes de Cambridge (inglés). */
export const EXAM_FORMATS: Record<ExamLevel, ExamFormat> = {
  A1: {
    system: 'cambridge',
    level: 'A1',
    exam: 'A1 (formato A2 Key)',
    official: false,
    pass: null,
    reading: { title: 'Reading and Writing', minutes: 60, parts: KEY_READING, scale: {} },
    listening: { title: 'Listening', minutes: 30, reviewS: 120, parts: KEY_LISTENING, scale: {} },
    speaking: { ...KEY_SPEAKING, scale: null },
    writing: null,
  },
  A2: {
    system: 'cambridge',
    level: 'A2',
    exam: 'A2 Key',
    official: true,
    pass: 120,
    reading: {
      title: 'Reading and Writing',
      minutes: 60,
      parts: KEY_READING,
      scale: { reading: { total: 30, anchors: [[28, 140], [20, 120], [13, 100], [7, 82]] } },
    },
    listening: {
      title: 'Listening',
      minutes: 30,
      reviewS: 120,
      parts: KEY_LISTENING,
      scale: { listening: { total: 25, anchors: [[23, 140], [17, 120], [11, 100], [6, 82]] } },
    },
    speaking: {
      ...KEY_SPEAKING,
      scale: { total: 45, anchors: [[41, 140], [27, 120], [18, 100], [10, 82]] },
    },
    writing: null,
  },
  B1: {
    system: 'cambridge',
    level: 'B1',
    exam: 'B1 Preliminary',
    official: true,
    pass: 140,
    reading: {
      title: 'Reading',
      minutes: 45,
      parts: [
        { type: 'mcq', name: 'Multiple choice (short texts)', questions: 5, marksEach: 1, section: 'reading', options: 3 },
        { type: 'matching', name: 'Matching', questions: 5, marksEach: 1, section: 'reading', choices: 8 },
        { type: 'mcq', name: 'Multiple choice (long text)', questions: 5, marksEach: 1, section: 'reading', options: 4 },
        { type: 'gapped_text', name: 'Gapped text', questions: 5, marksEach: 1, section: 'reading', choices: 8 },
        { type: 'mcq_cloze', name: 'Multiple-choice cloze', questions: 6, marksEach: 1, section: 'reading', options: 4 },
        { type: 'open_cloze', name: 'Open cloze', questions: 6, marksEach: 1, section: 'reading' },
      ],
      scale: { reading: { total: 32, anchors: [[29, 160], [23, 140], [13, 120], [5, 102]] } },
    },
    listening: {
      title: 'Listening',
      minutes: 30,
      reviewS: 120,
      parts: [
        { type: 'mcq', name: 'Multiple choice (short extracts)', questions: 7, marksEach: 1, section: 'listening', options: 3, groupPrepS: 8 },
        { type: 'mcq', name: 'Multiple choice (short dialogues)', questions: 6, marksEach: 1, section: 'listening', options: 3, groupPrepS: 12 },
        { type: 'completion', name: 'Gap fill', questions: 6, marksEach: 1, section: 'listening', prepS: 20 },
        { type: 'mcq', name: 'Multiple choice (interview)', questions: 6, marksEach: 1, section: 'listening', options: 3, prepS: 45 },
      ],
      scale: { listening: { total: 25, anchors: [[23, 160], [18, 140], [11, 120], [5, 102]] } },
    },
    speaking: {
      title: 'Speaking',
      minutes: 12,
      parts: [
        { kind: 'interview', name: 'Interview', minutes: 2 },
        { kind: 'long_turn', name: 'Extended turn', minutes: 3 },
        { kind: 'collaborative', name: 'Discussion', minutes: 4 },
        { kind: 'discussion', name: 'General conversation', minutes: 3 },
      ],
      criteria: [
        { key: 'grammar_vocabulary', weight: 1 },
        { key: 'discourse_management', weight: 1 },
        { key: 'pronunciation', weight: 1 },
        { key: 'interactive_communication', weight: 1 },
        { key: 'global_achievement', weight: 2 },
      ],
      scale: { total: 30, anchors: [[27, 160], [18, 140], [12, 120], [7, 102]] },
    },
    writing: { title: 'Writing', minutes: 45, tasks: 'Email + article or story (about 100 words each)' },
  },
  B2: {
    system: 'cambridge',
    level: 'B2',
    exam: 'B2 First',
    official: true,
    pass: 160,
    reading: {
      title: 'Reading and Use of English',
      minutes: 75,
      parts: [
        { type: 'mcq_cloze', name: 'Multiple-choice cloze', questions: 8, marksEach: 1, section: 'reading', options: 4 },
        { type: 'open_cloze', name: 'Open cloze', questions: 8, marksEach: 1, section: 'use_of_english' },
        { type: 'word_formation', name: 'Word formation', questions: 8, marksEach: 1, section: 'use_of_english' },
        { type: 'key_word_transformation', name: 'Key word transformations', questions: 6, marksEach: 2, section: 'use_of_english', words: [2, 5] },
        { type: 'mcq', name: 'Multiple choice', questions: 6, marksEach: 2, section: 'reading', options: 4 },
        { type: 'gapped_text', name: 'Gapped text', questions: 6, marksEach: 2, section: 'reading', choices: 7 },
        { type: 'matching', name: 'Multiple matching', questions: 10, marksEach: 1, section: 'reading' },
      ],
      scale: {
        reading: { total: 42, anchors: [[37, 180], [24, 160], [16, 140], [10, 122]] },
        use_of_english: { total: 28, anchors: [[24, 180], [18, 160], [11, 140], [7, 122]] },
      },
    },
    listening: {
      title: 'Listening',
      minutes: 40,
      reviewS: 120,
      parts: [
        { type: 'mcq', name: 'Multiple choice (short extracts)', questions: 8, marksEach: 1, section: 'listening', options: 3, groupPrepS: 12 },
        { type: 'completion', name: 'Sentence completion', questions: 10, marksEach: 1, section: 'listening', prepS: 45 },
        { type: 'matching', name: 'Multiple matching', questions: 5, marksEach: 1, section: 'listening', choices: 8, prepS: 30 },
        { type: 'mcq', name: 'Multiple choice (interview)', questions: 7, marksEach: 1, section: 'listening', options: 3, prepS: 60 },
      ],
      scale: { listening: { total: 30, anchors: [[27, 180], [18, 160], [12, 140], [8, 122]] } },
    },
    speaking: {
      title: 'Speaking',
      minutes: 14,
      parts: [
        { kind: 'interview', name: 'Interview', minutes: 2 },
        { kind: 'long_turn', name: 'Long turn', minutes: 4 },
        { kind: 'collaborative', name: 'Collaborative task', minutes: 4 },
        { kind: 'discussion', name: 'Discussion', minutes: 4 },
      ],
      criteria: [
        { key: 'grammar_vocabulary', weight: 2 },
        { key: 'discourse_management', weight: 2 },
        { key: 'pronunciation', weight: 2 },
        { key: 'interactive_communication', weight: 2 },
        { key: 'global_achievement', weight: 4 },
      ],
      scale: { total: 60, anchors: [[54, 180], [36, 160], [24, 140], [14, 122]] },
    },
    writing: { title: 'Writing', minutes: 80, tasks: 'Essay + one of article, email/letter, report or review (140–190 words each)' },
  },
  C1: {
    system: 'cambridge',
    level: 'C1',
    exam: 'C1 Advanced',
    official: true,
    pass: 180,
    reading: {
      title: 'Reading and Use of English',
      minutes: 90,
      parts: [
        { type: 'mcq_cloze', name: 'Multiple-choice cloze', questions: 8, marksEach: 1, section: 'reading', options: 4 },
        { type: 'open_cloze', name: 'Open cloze', questions: 8, marksEach: 1, section: 'use_of_english' },
        { type: 'word_formation', name: 'Word formation', questions: 8, marksEach: 1, section: 'use_of_english' },
        { type: 'key_word_transformation', name: 'Key word transformations', questions: 6, marksEach: 2, section: 'use_of_english', words: [3, 6] },
        { type: 'mcq', name: 'Multiple choice', questions: 6, marksEach: 2, section: 'reading', options: 4 },
        { type: 'matching', name: 'Cross-text multiple matching', questions: 4, marksEach: 2, section: 'reading', choices: 4 },
        { type: 'gapped_text', name: 'Gapped text', questions: 6, marksEach: 2, section: 'reading', choices: 7 },
        { type: 'matching', name: 'Multiple matching', questions: 10, marksEach: 1, section: 'reading' },
      ],
      scale: {
        reading: { total: 50, anchors: [[43, 200], [32, 180], [23, 160], [17, 142]] },
        use_of_english: { total: 28, anchors: [[23, 200], [16, 180], [11, 160], [8, 142]] },
      },
    },
    listening: {
      title: 'Listening',
      minutes: 40,
      reviewS: 120,
      parts: [
        { type: 'mcq', name: 'Multiple choice (short extracts)', questions: 6, marksEach: 1, section: 'listening', options: 3, groupPrepS: 15 },
        { type: 'completion', name: 'Sentence completion', questions: 8, marksEach: 1, section: 'listening', prepS: 45 },
        { type: 'mcq', name: 'Multiple choice (interview)', questions: 6, marksEach: 1, section: 'listening', options: 4, prepS: 70 },
        { type: 'matching', name: 'Multiple matching', questions: 10, marksEach: 1, section: 'listening', choices: 8, tasks: 2, prepS: 45 },
      ],
      scale: { listening: { total: 30, anchors: [[26, 200], [18, 180], [13, 160], [11, 142]] } },
    },
    speaking: {
      title: 'Speaking',
      minutes: 15,
      parts: [
        { kind: 'interview', name: 'Interview', minutes: 2 },
        { kind: 'long_turn', name: 'Long turn', minutes: 4 },
        { kind: 'collaborative', name: 'Collaborative task', minutes: 4 },
        { kind: 'discussion', name: 'Discussion', minutes: 5 },
      ],
      criteria: HIGHER_CRITERIA,
      scale: { total: 75, anchors: [[66, 200], [45, 180], [30, 160], [17, 142]] },
    },
    writing: { title: 'Writing', minutes: 90, tasks: 'Essay + one of letter/email, proposal, report or review (220–260 words each)' },
  },
  C2: {
    system: 'cambridge',
    level: 'C2',
    exam: 'C2 Proficiency',
    official: true,
    pass: 200,
    reading: {
      title: 'Reading and Use of English',
      minutes: 90,
      parts: [
        { type: 'mcq_cloze', name: 'Multiple-choice cloze', questions: 8, marksEach: 1, section: 'reading', options: 4 },
        { type: 'open_cloze', name: 'Open cloze', questions: 8, marksEach: 1, section: 'use_of_english' },
        { type: 'word_formation', name: 'Word formation', questions: 8, marksEach: 1, section: 'use_of_english' },
        { type: 'key_word_transformation', name: 'Key word transformations', questions: 6, marksEach: 2, section: 'use_of_english', words: [3, 8] },
        { type: 'mcq', name: 'Multiple choice', questions: 6, marksEach: 2, section: 'reading', options: 4 },
        { type: 'gapped_text', name: 'Gapped text', questions: 7, marksEach: 2, section: 'reading', choices: 8 },
        { type: 'matching', name: 'Multiple matching', questions: 10, marksEach: 1, section: 'reading' },
      ],
      scale: {
        reading: { total: 44, anchors: [[36, 220], [28, 200], [22, 180], [14, 162]] },
        use_of_english: { total: 28, anchors: [[22, 220], [17, 200], [13, 180], [9, 162]] },
      },
    },
    listening: {
      title: 'Listening',
      minutes: 40,
      reviewS: 120,
      parts: [
        { type: 'mcq', name: 'Multiple choice (short extracts)', questions: 6, marksEach: 1, section: 'listening', options: 3, groupPrepS: 15 },
        { type: 'completion', name: 'Sentence completion', questions: 9, marksEach: 1, section: 'listening', prepS: 45 },
        { type: 'mcq', name: 'Multiple choice (discussion)', questions: 5, marksEach: 1, section: 'listening', options: 4, prepS: 60 },
        { type: 'matching', name: 'Multiple matching', questions: 10, marksEach: 1, section: 'listening', choices: 8, tasks: 2, prepS: 45 },
      ],
      scale: { listening: { total: 30, anchors: [[24, 220], [18, 200], [14, 180], [10, 162]] } },
    },
    speaking: {
      title: 'Speaking',
      minutes: 16,
      parts: [
        { kind: 'interview', name: 'Interview', minutes: 2 },
        { kind: 'collaborative', name: 'Collaborative task', minutes: 4 },
        { kind: 'long_turn', name: 'Long turn and discussion', minutes: 10 },
      ],
      criteria: HIGHER_CRITERIA,
      scale: { total: 75, anchors: [[66, 220], [45, 200], [30, 180], [17, 162]] },
    },
    writing: { title: 'Writing', minutes: 90, tasks: 'Essay on two texts (240–280 words) + one of article, letter, report or review (280–320 words)' },
  },
};

/** Puntos que vale una parte. */
export function partMarks(part: PartFormat): number {
  return part.type === 'writing' ? 0 : part.questions * part.marksEach;
}

/** Preguntas con nota automática de una prueba (las de redacción no cuentan). */
export function paperQuestions(parts: readonly PartFormat[]): number {
  return parts.reduce((sum, part) => sum + (part.type === 'writing' ? 0 : part.questions), 0);
}

export function paperMarks(parts: readonly PartFormat[]): number {
  return parts.reduce((sum, part) => sum + partMarks(part), 0);
}

/** Puntos máximos de la prueba de Speaking con los pesos del examen (60 en B2 First). */
export function speakingMarks(format: ExamFormat): number {
  return format.speaking.criteria.reduce((sum, criterion) => sum + criterion.weight * 5, 0);
}

// ───────────── DELE (español) ─────────────

const DELE_CRITERIA = [
  { key: 'coherence', weight: 1 },
  { key: 'fluency', weight: 1 },
  { key: 'accuracy', weight: 1 },
  { key: 'range', weight: 1 },
  { key: 'holistic', weight: 1 },
] as const;

/** El DELE puntúa cada prueba sobre 25 y no tiene tabla de conversión: se aprueba con el 60 %. */
const deleFormat = (
  level: ExamLevel,
  reading: ExamFormat['reading'],
  listening: ExamFormat['listening'],
  speaking: Pick<ExamFormat['speaking'], 'minutes' | 'parts'>,
  writing: NonNullable<ExamFormat['writing']>,
): ExamFormat => ({
  system: 'dele',
  level,
  exam: `DELE ${level}`,
  official: true,
  pass: null,
  reading,
  listening,
  speaking: { title: 'Expresión e interacción orales', ...speaking, criteria: DELE_CRITERIA, scale: null },
  writing,
});

const READING = 'Comprensión de lectura';
const LISTENING = 'Comprensión auditiva';
const WRITING = 'Expresión e interacción escritas';

/** Los exámenes DELE del Instituto Cervantes (español). */
export const DELE_FORMATS: Record<ExamLevel, ExamFormat> = {
  A1: deleFormat(
    'A1',
    {
      title: READING,
      minutes: 45,
      parts: [
        { type: 'mcq', name: 'Tarea 1: correo o mensaje', questions: 5, marksEach: 1, section: 'reading', options: 3 },
        { type: 'mcq', name: 'Tarea 2: textos breves', questions: 6, marksEach: 1, section: 'reading', options: 3 },
        { type: 'matching', name: 'Tarea 3: anuncios', questions: 6, marksEach: 1, section: 'reading', choices: 8 },
        { type: 'mcq', name: 'Tarea 4: texto informativo', questions: 8, marksEach: 1, section: 'reading', options: 3 },
      ],
      scale: {},
    },
    {
      title: LISTENING,
      minutes: 20,
      reviewS: 60,
      parts: [
        { type: 'mcq', name: 'Tarea 1: diálogos breves', questions: 5, marksEach: 1, section: 'listening', options: 3, groupPrepS: 8 },
        { type: 'mcq', name: 'Tarea 2: mensajes y anuncios', questions: 5, marksEach: 1, section: 'listening', options: 3, groupPrepS: 8 },
        { type: 'matching', name: 'Tarea 3: conversación', questions: 6, marksEach: 1, section: 'listening', choices: 8, prepS: 20 },
        { type: 'completion', name: 'Tarea 4: completar notas', questions: 9, marksEach: 1, section: 'listening', prepS: 20 },
      ],
      scale: {},
    },
    {
      minutes: 15,
      parts: [
        { kind: 'long_turn', name: 'Tarea 1: presentación personal', minutes: 2 },
        { kind: 'long_turn', name: 'Tarea 2: exposición de un tema', minutes: 3 },
        { kind: 'discussion', name: 'Tarea 3: conversación', minutes: 4 },
        { kind: 'collaborative', name: 'Tarea 4: diálogos breves', minutes: 4 },
      ],
    },
    { title: WRITING, minutes: 25, tasks: '2 tareas: un formulario y un texto breve (20–30 palabras)' },
  ),
  A2: deleFormat(
    'A2',
    {
      title: READING,
      minutes: 60,
      parts: [
        { type: 'mcq', name: 'Tarea 1: texto', questions: 5, marksEach: 1, section: 'reading', options: 3 },
        { type: 'mcq', name: 'Tarea 2: textos breves', questions: 8, marksEach: 1, section: 'reading', options: 3 },
        { type: 'matching', name: 'Tarea 3: relacionar personas y textos', questions: 6, marksEach: 1, section: 'reading', choices: 8 },
        { type: 'mcq_cloze', name: 'Tarea 4: texto con huecos', questions: 6, marksEach: 1, section: 'reading', options: 3 },
      ],
      scale: {},
    },
    {
      title: LISTENING,
      minutes: 35,
      reviewS: 60,
      parts: [
        { type: 'mcq', name: 'Tarea 1: anuncios y mensajes', questions: 6, marksEach: 1, section: 'listening', options: 3, groupPrepS: 8 },
        { type: 'mcq', name: 'Tarea 2: programa de radio', questions: 6, marksEach: 1, section: 'listening', options: 3, prepS: 30 },
        { type: 'matching', name: 'Tarea 3: conversación', questions: 6, marksEach: 1, section: 'listening', choices: 8, prepS: 20 },
        { type: 'completion', name: 'Tarea 4: completar notas', questions: 7, marksEach: 1, section: 'listening', prepS: 20 },
      ],
      scale: {},
    },
    {
      minutes: 12,
      parts: [
        { kind: 'long_turn', name: 'Tarea 1: monólogo', minutes: 3 },
        { kind: 'long_turn', name: 'Tarea 2: descripción de una fotografía', minutes: 3 },
        { kind: 'discussion', name: 'Tarea 3: conversación', minutes: 3 },
        { kind: 'collaborative', name: 'Tarea 4: diálogo en una situación', minutes: 3 },
      ],
    },
    { title: WRITING, minutes: 45, tasks: '2 tareas: un correo (60–70 palabras) y un texto breve (70–80 palabras)' },
  ),
  B1: deleFormat(
    'B1',
    {
      title: READING,
      minutes: 70,
      parts: [
        { type: 'matching', name: 'Tarea 1: personas y textos breves', questions: 6, marksEach: 1, section: 'reading', choices: 8 },
        { type: 'mcq', name: 'Tarea 2: texto', questions: 6, marksEach: 1, section: 'reading', options: 3 },
        { type: 'matching', name: 'Tarea 3: tres textos', questions: 6, marksEach: 1, section: 'reading', choices: 3 },
        { type: 'gapped_text', name: 'Tarea 4: fragmentos', questions: 6, marksEach: 1, section: 'reading', choices: 8 },
        { type: 'mcq_cloze', name: 'Tarea 5: texto con huecos', questions: 6, marksEach: 1, section: 'reading', options: 3 },
      ],
      scale: {},
    },
    {
      title: LISTENING,
      minutes: 40,
      reviewS: 120,
      parts: [
        { type: 'mcq', name: 'Tarea 1: mensajes breves', questions: 6, marksEach: 1, section: 'listening', options: 3, groupPrepS: 10 },
        { type: 'mcq', name: 'Tarea 2: monólogo', questions: 6, marksEach: 1, section: 'listening', options: 3, prepS: 30 },
        { type: 'mcq', name: 'Tarea 3: noticias', questions: 6, marksEach: 1, section: 'listening', options: 3, groupPrepS: 10 },
        { type: 'matching', name: 'Tarea 4: monólogos breves', questions: 6, marksEach: 1, section: 'listening', choices: 8, prepS: 30 },
        { type: 'mcq', name: 'Tarea 5: conversación', questions: 6, marksEach: 1, section: 'listening', options: 3, prepS: 30 },
      ],
      scale: {},
    },
    {
      minutes: 15,
      parts: [
        { kind: 'long_turn', name: 'Tarea 1: presentación de un tema', minutes: 3 },
        { kind: 'discussion', name: 'Tarea 2: conversación sobre la presentación', minutes: 3 },
        { kind: 'long_turn', name: 'Tarea 3: descripción de una fotografía', minutes: 3 },
        { kind: 'collaborative', name: 'Tarea 4: situación simulada', minutes: 3 },
      ],
    },
    { title: WRITING, minutes: 60, tasks: '2 tareas: un correo (100–120 palabras) y una composición (130–150 palabras)' },
  ),
  B2: deleFormat(
    'B2',
    {
      title: READING,
      minutes: 70,
      parts: [
        { type: 'mcq', name: 'Tarea 1: texto', questions: 6, marksEach: 1, section: 'reading', options: 3 },
        { type: 'matching', name: 'Tarea 2: cuatro textos', questions: 10, marksEach: 1, section: 'reading', choices: 4 },
        { type: 'gapped_text', name: 'Tarea 3: fragmentos', questions: 6, marksEach: 1, section: 'reading', choices: 8 },
        { type: 'mcq_cloze', name: 'Tarea 4: texto con huecos', questions: 14, marksEach: 1, section: 'reading', options: 3 },
      ],
      scale: {},
    },
    {
      title: LISTENING,
      minutes: 40,
      reviewS: 120,
      parts: [
        { type: 'mcq', name: 'Tarea 1: conversaciones breves', questions: 6, marksEach: 1, section: 'listening', options: 3, groupPrepS: 10 },
        { type: 'mcq', name: 'Tarea 2: conversación', questions: 6, marksEach: 1, section: 'listening', options: 3, prepS: 30 },
        { type: 'mcq', name: 'Tarea 3: entrevista', questions: 6, marksEach: 1, section: 'listening', options: 3, prepS: 30 },
        { type: 'matching', name: 'Tarea 4: monólogos breves', questions: 6, marksEach: 1, section: 'listening', choices: 8, prepS: 30 },
        { type: 'mcq', name: 'Tarea 5: conferencia', questions: 6, marksEach: 1, section: 'listening', options: 3, prepS: 30 },
      ],
      scale: {},
    },
    {
      minutes: 20,
      parts: [
        { kind: 'long_turn', name: 'Tarea 1: valorar propuestas', minutes: 6 },
        { kind: 'collaborative', name: 'Tarea 2: conversar sobre una situación', minutes: 6 },
        { kind: 'discussion', name: 'Tarea 3: comentar una encuesta', minutes: 4 },
      ],
    },
    { title: WRITING, minutes: 80, tasks: '2 tareas: una carta a partir de una audición y un texto de opinión o un artículo (150–180 palabras cada una)' },
  ),
  C1: deleFormat(
    'C1',
    {
      title: 'Comprensión de lectura y uso de la lengua',
      minutes: 90,
      parts: [
        { type: 'mcq', name: 'Tarea 1: texto', questions: 6, marksEach: 1, section: 'reading', options: 3 },
        { type: 'gapped_text', name: 'Tarea 2: fragmentos', questions: 6, marksEach: 1, section: 'reading', choices: 7 },
        { type: 'mcq', name: 'Tarea 3: texto', questions: 6, marksEach: 1, section: 'reading', options: 3 },
        { type: 'matching', name: 'Tarea 4: seis textos breves', questions: 8, marksEach: 1, section: 'reading', choices: 6 },
        { type: 'mcq_cloze', name: 'Tarea 5: texto con huecos', questions: 14, marksEach: 1, section: 'reading', options: 3 },
      ],
      scale: {},
    },
    {
      title: 'Comprensión auditiva y uso de la lengua',
      minutes: 50,
      reviewS: 120,
      parts: [
        { type: 'completion', name: 'Tarea 1: conferencia', questions: 6, marksEach: 1, section: 'listening', prepS: 45 },
        { type: 'mcq', name: 'Tarea 2: conversaciones', questions: 6, marksEach: 1, section: 'listening', options: 3, groupPrepS: 20 },
        { type: 'mcq', name: 'Tarea 3: entrevista', questions: 6, marksEach: 1, section: 'listening', options: 3, prepS: 45 },
        { type: 'mcq', name: 'Tarea 4: fragmentos breves', questions: 12, marksEach: 1, section: 'listening', options: 3, groupPrepS: 15 },
      ],
      scale: {},
    },
    {
      minutes: 20,
      parts: [
        { kind: 'long_turn', name: 'Tarea 1: presentación oral', minutes: 5 },
        { kind: 'discussion', name: 'Tarea 2: conversación sobre la presentación', minutes: 5 },
        { kind: 'collaborative', name: 'Tarea 3: llegar a un acuerdo', minutes: 6 },
      ],
    },
    { title: WRITING, minutes: 80, tasks: '2 tareas: un texto a partir de una audición (220–250 palabras) y un texto de opinión, crítica o artículo (180–220 palabras)' },
  ),
  C2: deleFormat(
    'C2',
    {
      title: 'Uso de la lengua y comprensión de lectura',
      minutes: 60,
      parts: [
        { type: 'mcq_cloze', name: 'Tarea 1: texto con huecos', questions: 6, marksEach: 1, section: 'reading', options: 3 },
        { type: 'gapped_text', name: 'Tarea 2: fragmentos', questions: 7, marksEach: 1, section: 'reading', choices: 8 },
        { type: 'matching', name: 'Tarea 3: seis textos', questions: 8, marksEach: 1, section: 'reading', choices: 6 },
        { type: 'mcq', name: 'Tarea 4: texto', questions: 6, marksEach: 1, section: 'reading', options: 3 },
      ],
      scale: {},
    },
    {
      title: LISTENING,
      minutes: 45,
      reviewS: 120,
      parts: [
        { type: 'completion', name: 'Tarea 5: conferencia', questions: 6, marksEach: 1, section: 'listening', prepS: 45 },
        { type: 'matching', name: 'Tarea 6: opiniones', questions: 6, marksEach: 1, section: 'listening', choices: 8, prepS: 45 },
        { type: 'mcq', name: 'Tarea 7: debate', questions: 6, marksEach: 1, section: 'listening', options: 3, prepS: 45 },
      ],
      scale: {},
    },
    {
      minutes: 20,
      parts: [
        { kind: 'long_turn', name: 'Tarea 1: exposición a partir de textos', minutes: 6 },
        { kind: 'discussion', name: 'Tarea 2: conversación sobre la exposición', minutes: 6 },
        { kind: 'collaborative', name: 'Tarea 3: conversación a partir de titulares', minutes: 6 },
      ],
    },
    { title: WRITING, minutes: 150, tasks: '3 tareas: un texto a partir de una audición y unas lecturas (400–450 palabras) y dos textos más breves' },
  ),
};

/** El formato del examen de un nivel en el idioma que se practica. */
export function examFormat(level: ExamLevel, language: PracticeLanguage): ExamFormat {
  return language === 'es' ? DELE_FORMATS[level] : EXAM_FORMATS[level];
}
