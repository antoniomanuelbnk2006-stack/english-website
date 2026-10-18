'use server';

import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  gradeExamPaper,
  gradeSpeaking,
  isAnswered,
  type SpeakingRatings,
} from '@/features/exams/lib/grade';
import { bandCenter, DEFAULT_RATING } from '@/features/level/lib/bands';
import { fail, ok, type ActionResult } from '@/lib/actions';
import { requireUser } from '@/lib/auth';
import { EXAM_FORMATS, SPEAKING_CRITERIA, type ExamSection } from '@/lib/content/exam-formats';
import { ExamPaperId } from '@/lib/content/exam-schema';
import { findExamPaper } from '@/lib/content/exams';
import type { Json } from '@/lib/supabase/database.types';
import { getLocale } from '@/lib/i18n/server';
import { languageOfId } from '@/lib/content/language';

const toJson = (value: unknown): Json => JSON.parse(JSON.stringify(value)) as Json;

// Una prueba entregada se guarda como las lecciones: el progreso en `lesson_progress` con el id
// de la prueba (`b2-exam-01-reading`) y cada respuesta en `item_attempts`. Todas las respuestas
// de una misma entrega llevan el mismo `sitting`: así se puede volver a ver la corrección.
// No mueve el nivel estimado ni da XP: es una nota de examen, no práctica diaria.

const SKILL: Record<ExamSection, string> = {
  reading: 'reading',
  use_of_english: 'grammar',
  listening: 'listening',
  writing: 'writing',
};

/** Id estable de un intento: repetir la misma entrega no la guarda dos veces. */
function attemptId(sitting: string, item: string): string {
  const hex = createHash('sha256').update(`${sitting}:${item}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

const SubmitInput = z.object({
  paperId: ExamPaperId,
  version: z.number().int().positive(),
  /** Identifica esta entrega. */
  sitting: z.uuid(),
  answers: z
    .array(
      z.object({
        n: z.number().int().positive().max(60),
        /** Texto o letra, o el índice de la opción en las preguntas de elegir. */
        value: z.union([z.string().max(200), z.number().int().min(0).max(3)]),
      }),
    )
    .max(60),
  durationMs: z.number().int().min(0).max(10_800_000),
});

/**
 * Corrige una prueba de Reading o de Listening con los puntos del examen y la guarda. La
 * corrección detallada se ve después en la página de resultado, que la vuelve a calcular.
 */
export async function submitExamPaper(
  input: unknown,
): Promise<ActionResult<{ marks: number; total: number }>> {
  const parsed = SubmitInput.safeParse(input);
  if (!parsed.success) return fail('invalid_input');
  const { paperId, version, sitting, answers, durationMs } = parsed.data;

  const session = await requireUser();
  if (!session.ok) return fail('unauthorized');
  const { supabase } = session;

  const paper = findExamPaper(paperId, await getLocale());
  if (!paper || paper.paper === 'speaking') return fail('not_found');
  if (paper.version !== version) return fail('conflict');

  const given = Object.fromEntries(answers.map((answer) => [answer.n, answer.value]));
  const result = gradeExamPaper(paper, given);
  // Entregar en blanco no es un intento: no hay nada que guardar.
  if (result.answered === 0) return fail('invalid_input');

  const language = languageOfId(paper.id);
  const { data: ratings, error: ratingError } = await supabase
    .from('skill_ratings')
    .select('skill, rating')
    .eq('language', language);
  if (ratingError) return fail('internal');
  const ratingOf = new Map(ratings.map((row) => [row.skill as string, row.rating]));

  const perItem = Math.round(durationMs / Math.max(1, result.questions));
  const rows = result.parts.flatMap((part) =>
    part.items.flatMap((item) => {
      const value = given[item.n];
      if (!isAnswered(value)) return [];
      const skill = SKILL[part.section];
      return [
        {
          item_id: `${paper.id}:${item.n}`,
          skill,
          task_type: `exam_${part.type}`,
          focus: 'exam',
          phase: 'exam',
          item_difficulty: bandCenter(paper.level),
          rating_before: ratingOf.get(skill) ?? DEFAULT_RATING,
          score: item.marks / item.max,
          response: { type: 'exam', value, sitting },
          duration_ms: perItem,
          client_id: attemptId(sitting, String(item.n)),
        },
      ];
    }),
  );

  const { error } = await supabase.rpc('apply_lesson_attempts', {
    p_lesson_id: paper.id,
    p_language: language,
    p_lesson_version: paper.version,
    p_attempts: toJson(rows),
    p_ratings: {},
    p_progress: toJson({
      status: 'completed',
      phase: 1,
      score: result.score,
      time_spent_s: Math.round(durationMs / 1000),
    }),
  });
  if (error) return fail('internal');

  return ok({ marks: result.marks, total: result.total });
}

const SpeakingInput = z.object({
  paperId: ExamPaperId,
  version: z.number().int().positive(),
  sitting: z.uuid(),
  /** Autoevaluación: de 0 a 5 por criterio, con medios puntos como el examinador. */
  ratings: z.partialRecord(z.enum(SPEAKING_CRITERIA), z.number().min(0).max(5).multipleOf(0.5)),
  durationMs: z.number().int().min(0).max(10_800_000),
});

/**
 * Guarda la autoevaluación de una prueba de Speaking. La nota la pone el propio usuario con
 * los criterios del examinador: sirve para seguir su progreso, no como medida fiable.
 */
export async function saveSpeakingExam(
  input: unknown,
): Promise<ActionResult<{ marks: number; total: number }>> {
  const parsed = SpeakingInput.safeParse(input);
  if (!parsed.success) return fail('invalid_input');
  const { paperId, version, sitting, durationMs } = parsed.data;

  const session = await requireUser();
  if (!session.ok) return fail('unauthorized');
  const { supabase } = session;

  const paper = findExamPaper(paperId, await getLocale());
  if (!paper || paper.paper !== 'speaking') return fail('not_found');
  if (paper.version !== version) return fail('conflict');

  const result = gradeSpeaking(EXAM_FORMATS[paper.level], parsed.data.ratings as SpeakingRatings);
  if (!result) return fail('invalid_input');

  const language = languageOfId(paper.id);
  const { data: ratingRow, error: ratingError } = await supabase
    .from('skill_ratings')
    .select('rating')
    .eq('language', language)
    .eq('skill', 'speaking')
    .maybeSingle();
  if (ratingError) return fail('internal');

  const { error } = await supabase.rpc('apply_lesson_attempts', {
    p_lesson_id: paper.id,
    p_language: language,
    p_lesson_version: paper.version,
    p_attempts: toJson(
      result.criteria.map((criterion) => ({
        item_id: `${paper.id}:${criterion.key}`,
        skill: 'speaking',
        task_type: 'exam_speaking',
        focus: 'self_assessment',
        phase: 'exam',
        item_difficulty: bandCenter(paper.level),
        rating_before: ratingRow?.rating ?? DEFAULT_RATING,
        score: criterion.rating / 5,
        response: { type: 'exam', value: criterion.rating, sitting },
        duration_ms: Math.round(durationMs / result.criteria.length),
        client_id: attemptId(sitting, criterion.key),
      })),
    ),
    p_ratings: {},
    p_progress: toJson({
      status: 'completed',
      phase: 1,
      score: result.score,
      time_spent_s: Math.round(durationMs / 1000),
    }),
  });
  if (error) return fail('internal');

  return ok({ marks: result.marks, total: result.total });
}
