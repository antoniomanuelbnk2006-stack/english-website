import type { z } from 'zod';
import type { PublishedListening, Task } from '@/lib/content/schema';

// Qué parte de una lección de escucha puede ver el cliente en cada momento. Lógica pura.
// Regla estricta: la transcripción no sale del servidor antes de la fase 3 del ciclo.

type Lesson = z.infer<typeof PublishedListening>;

export type ListeningTask = Exclude<Task, { type: 'dictation' }>;
export type DictationTask = Extract<Task, { type: 'dictation' }>;

/** Lo que se envía al entrar en la lección: audio, tiempos y preguntas; nada del guion. */
export interface ListeningIntro {
  id: string;
  version: number;
  title: string;
  level: Lesson['level'];
  genre: Lesson['genre'];
  unit: string;
  summary_es: string;
  prediction_prompt?: string;
  preTeach: { word: string; def_en?: string; def_es?: string }[];
  speakers: { id: string; name: string; accent: string }[];
  audio: { src: string; duration_s: number; wpm: number; peaks: number[] };
  /** Segmentos sin texto: solo para navegar por frases. */
  segments: { id: string; speaker: string; start: number; end: number }[];
  /** Preguntas de las dos escuchas, sin la explicación (cita el guion). */
  tasks: ListeningTask[];
  dictationCount: number;
}

export function toIntro(lesson: Lesson): ListeningIntro {
  return {
    id: lesson.id,
    version: lesson.version,
    title: lesson.title,
    level: lesson.level,
    genre: lesson.genre,
    unit: lesson.unit,
    summary_es: lesson.summary_es,
    prediction_prompt: lesson.prediction_prompt,
    preTeach: lesson.pre_teach.map((word) => {
      const entry = lesson.glossary.find((g) => g.lemma === word);
      return { word, def_en: entry?.def_en, def_es: entry?.def_es };
    }),
    speakers: lesson.speakers.map(({ id, name, accent }) => ({ id, name, accent })),
    audio: {
      src: lesson.audio.src,
      duration_s: lesson.audio.duration_s,
      wpm: lesson.audio.wpm,
      peaks: lesson.audio.peaks,
    },
    segments: lesson.segments.map(({ id, speaker, start, end }) => ({ id, speaker, start, end })),
    tasks: lesson.tasks
      .filter((task): task is ListeningTask => task.type !== 'dictation')
      .map((task) => ({ ...task, rationale_es: '' })),
    dictationCount: lesson.tasks.filter((task) => task.type === 'dictation').length,
  };
}

/** Lo que se entrega al completar la fase 2: guion, rasgos, glosario, dictados y explicaciones. */
export interface ListeningTranscript {
  segments: Lesson['segments'];
  connectedSpeech: Lesson['connected_speech'];
  glossary: Lesson['glossary'];
  dictations: DictationTask[];
  /** Explicación de cada pregunta, por id de tarea. */
  rationales: Record<string, string>;
}

export function toTranscript(lesson: Lesson): ListeningTranscript {
  return {
    segments: lesson.segments,
    connectedSpeech: lesson.connected_speech,
    glossary: lesson.glossary,
    dictations: lesson.tasks.filter((task): task is DictationTask => task.type === 'dictation'),
    rationales: Object.fromEntries(lesson.tasks.map((task) => [task.id, task.rationale_es])),
  };
}

/** Fase del ciclo a partir de la cual el cliente puede recibir la transcripción. */
export const TRANSCRIPT_FROM_PHASE = 3;
