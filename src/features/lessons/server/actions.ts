'use server';

import { SubmitAttemptsInput, lessonScore, prepareAttempts } from '@/features/lessons/lib/attempts';
import { DEFAULT_RATING } from '@/features/level/lib/bands';
import { fail, ok, type ActionResult } from '@/lib/actions';
import { requireUser } from '@/lib/auth';
import { loadLesson } from '@/lib/content/loader';
import { todayMadrid } from '@/lib/dates';
import type { Json } from '@/lib/supabase/database.types';
import { languageOfId } from '@/lib/content/language';

/** Los objetos tipados del dominio son JSON válido; así lo ve también el cliente de Supabase. */
const toJson = (value: unknown): Json => JSON.parse(JSON.stringify(value)) as Json;

export interface SubmitAttemptsResult {
  /** Nota de la lección (0–1) si se ha completado; si no, `null`. */
  score: number | null;
  completed: boolean;
}

/**
 * Guarda los intentos de una fase y el progreso de la lección en una sola transacción
 * (función SQL `apply_lesson_attempts`). Es idempotente por `clientId`.
 */
export async function submitAttempts(input: unknown): Promise<ActionResult<SubmitAttemptsResult>> {
  const parsed = SubmitAttemptsInput.safeParse(input);
  if (!parsed.success) return fail('invalid_input');
  const { lessonId, lessonVersion, attempts, progress } = parsed.data;

  const session = await requireUser();
  if (!session.ok) return fail('unauthorized');
  const { supabase } = session;

  const lesson = await loadLesson(lessonId);
  if (!lesson) return fail('not_found');
  // La lección cambió mientras se hacía: los ids de tarea podrían no significar lo mismo.
  if (lesson.version !== lessonVersion) return fail('conflict');

  const language = languageOfId(lesson.id);
  const { data: ratingRow, error: ratingError } = await supabase
    .from('skill_ratings')
    .select('rating')
    .eq('language', language)
    .eq('skill', lesson.skill)
    .maybeSingle();
  if (ratingError) return fail('internal');
  const rating = ratingRow?.rating ?? DEFAULT_RATING;

  const { rows, unknownItems } = prepareAttempts(lesson, attempts, rating);
  if (unknownItems.length > 0) return fail('invalid_input');

  let score: number | null = null;
  if (progress.completed) {
    const { data: past, error: pastError } = await supabase
      .from('item_attempts')
      .select('item_id, score')
      .eq('lesson_id', lesson.id)
      .order('created_at', { ascending: true });
    if (pastError) return fail('internal');
    score = lessonScore([
      ...past.map((row) => ({ itemId: row.item_id, score: row.score })),
      ...rows.map((row) => ({ itemId: row.item_id, score: row.score })),
    ]);
  }

  const { error: applyError } = await supabase.rpc('apply_lesson_attempts', {
    p_lesson_id: lesson.id,
    p_language: language,
    p_lesson_version: lesson.version,
    p_attempts: toJson(rows),
    // El rating no se mueve todavía: el Elo por destreza llega en la fase 5 del roadmap.
    p_ratings: {},
    p_progress: toJson({
      status: progress.completed ? 'completed' : 'started',
      phase: progress.phase,
      score,
      time_spent_s: progress.activeSeconds,
      reading_wpm: progress.readingWpm ?? null,
    }),
  });
  if (applyError) return fail('internal');

  // El tiempo de trabajo en la app también cuenta en el diario de input del día, y las palabras
  // leídas se anotan al completar (aunque ese último envío no traiga tiempo nuevo).
  const minutes = progress.activeSeconds / 60;
  const words = progress.completed && lesson.skill === 'reading' ? lesson.word_count : 0;
  if (minutes > 0 || words > 0) {
    const day = todayMadrid();

    const { data: entry, error: entryError } = await supabase
      .from('input_log')
      .select('id, minutes, words')
      .eq('lesson_id', lesson.id)
      .eq('logged_on', day)
      .eq('source', 'app')
      .limit(1)
      .maybeSingle();
    if (entryError) return fail('internal');

    let logError: { message: string } | null = null;
    if (entry) {
      ({ error: logError } = await supabase
        .from('input_log')
        .update({
          minutes: entry.minutes + minutes,
          words: words > 0 ? (entry.words ?? 0) + words : entry.words,
        })
        .eq('id', entry.id));
    } else if (minutes > 0) {
      // (Una entrada del diario necesita minutos > 0: sin tiempo activo no hay nada que anotar.)
      ({ error: logError } = await supabase.from('input_log').insert({
        kind: lesson.skill === 'reading' ? 'intensive_reading' : 'intensive_listening',
        source: 'app',
        minutes,
        words: words > 0 ? words : null,
        title: lesson.title,
        perceived_level: lesson.level,
        lesson_id: lesson.id,
        logged_on: day,
      }));
    }
    if (logError) return fail('internal');
  }

  return ok({ score, completed: progress.completed });
}
