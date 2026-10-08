import 'server-only';
import { cache } from 'react';
import { getSessionOrRedirect } from '@/lib/auth';

export interface LessonProgress {
  lessonId: string;
  lessonVersion: number;
  status: 'started' | 'completed';
  phase: number;
  score: number | null;
  bestScore: number | null;
  readingWpm: number | null;
  timeSpentS: number;
  completedAt: string | null;
  /** Se vio la transcripción antes de completar las dos escuchas a ciegas. */
  transcriptFirst: boolean;
}

const COLUMNS =
  'lesson_id, lesson_version, status, phase, score, best_score, reading_wpm, time_spent_s, completed_at, transcript_first';

/** Progreso del usuario en todas las lecciones que ha empezado, por id de lección. */
export const getProgressByLesson = cache(async (): Promise<Map<string, LessonProgress>> => {
  const { supabase } = await getSessionOrRedirect();
  const { data, error } = await supabase.from('lesson_progress').select(COLUMNS);
  if (error) throw new Error(`No se pudo leer el progreso: ${error.message}`);

  return new Map(
    data.map((row) => [
      row.lesson_id,
      {
        lessonId: row.lesson_id,
        lessonVersion: row.lesson_version,
        status: row.status,
        phase: row.phase,
        score: row.score,
        bestScore: row.best_score,
        readingWpm: row.reading_wpm,
        timeSpentS: row.time_spent_s,
        completedAt: row.completed_at,
        transcriptFirst: row.transcript_first,
      },
    ]),
  );
});

export async function getLessonProgress(lessonId: string): Promise<LessonProgress | null> {
  return (await getProgressByLesson()).get(lessonId) ?? null;
}
