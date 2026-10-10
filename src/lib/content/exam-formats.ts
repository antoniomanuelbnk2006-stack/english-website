// Formato oficial de los exámenes de Cambridge por nivel (docs/adr/0017-simulacros-de-examen.md):
// pruebas, partes, número de preguntas, puntos y tiempo. Sale de la página «Exam format» de cada
// examen en cambridgeenglish.org; la conversión a la escala Cambridge, de su guía «Converting
// practice test scores to Cambridge English Scale scores» (2023). Datos puros, sin contenido.

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
  'grammar_vocabulary',
  'grammatical_resource',
  'lexical_resource',
  'discourse_management',
  'pronunciation',
  'interactive_communication',
  'global_achievement',
] as const;
export type SpeakingCriterion = (typeof SPEAKING_CRITERIA)[number];

export interface ExamFormat {
  level: ExamLevel;
  /** Nombre del examen: «B2 First». */
  exam: string;
  /** `false` en A1: Cambridge no tiene examen de A1 para adultos (se usa el formato del A2 Key). */
  official: boolean;
  /** Nota de la escala Cambridge con la que se aprueba; `null` si el examen no tiene escala. */
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

export const EXAM_FORMATS: Record<ExamLevel, ExamFormat> = {
  A1: {
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
