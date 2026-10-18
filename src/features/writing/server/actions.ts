'use server';

import { insertCards } from '@/features/srs/server/cards';
import { reviewText, type SelfReview } from '@/features/writing/lib/checks';
import {
  CardsInput,
  RewriteInput,
  SelfAssessmentInput,
  SubmissionInput,
} from '@/features/writing/lib/input';
import { parseStoredFeedback, type SelfAssessment } from '@/features/writing/lib/schema';
import { cardCandidates, toOffer } from '@/features/writing/server/cards';
import { fail, ok, type ActionResult } from '@/lib/actions';
import { requireUser } from '@/lib/auth';
import { findWritingPrompt } from '@/lib/content/writing';
import { countWords } from '@/lib/content/writing-schema';
import type { Json } from '@/lib/supabase/database.types';
import { getLocale } from '@/lib/i18n/server';
import { languageOfId } from '@/lib/content/language';

const toJson = (value: unknown): Json => JSON.parse(JSON.stringify(value)) as Json;

export interface SelfReviewResult {
  id: string;
  review: SelfReview;
  /** La respuesta modelo: solo sale del servidor aquí, después de entregar. */
  modelAnswer: string;
  /** Errores que se pueden pasar al repaso. */
  cards: { front: string; back: string }[];
}

/**
 * Entrega un writing para revisarlo sin IA: lo guarda y devuelve las comprobaciones
 * automáticas y la respuesta modelo (ADR-0014).
 */
export async function submitSelfReview(input: unknown): Promise<ActionResult<SelfReviewResult>> {
  const parsed = SubmissionInput.safeParse(input);
  if (!parsed.success) return fail('invalid_input');
  const { promptId, text, examMode, activeSeconds } = parsed.data;

  const session = await requireUser();
  if (!session.ok) return fail('unauthorized');

  const prompt = findWritingPrompt(promptId, await getLocale());
  if (!prompt) return fail('not_found');

  const assessment: SelfAssessment = { kind: 'self', scores: null, points: [] };
  const { data, error } = await session.supabase
    .from('writing_submissions')
    .insert({
      prompt_id: prompt.id,
      task_type: prompt.task_type,
      target_level: prompt.level,
      text,
      word_count: countWords(text),
      status: 'done',
      review_kind: 'self',
      feedback: toJson(assessment),
      exam_mode: examMode,
      active_seconds: activeSeconds,
    })
    .select('id')
    .single();
  if (error || !data) return fail('internal');

  const review = reviewText(text, {
    language: languageOfId(prompt.id),
    level: prompt.level,
    taskType: prompt.task_type,
    wordsMin: prompt.words_min,
    wordsMax: prompt.words_max,
  });
  const cards = cardCandidates({
    id: data.id,
    text,
    promptId: prompt.id,
    taskType: prompt.task_type,
    feedback: { kind: 'self', scores: null, points: [] },
  });
  return ok({ id: data.id, review, modelAnswer: prompt.model_answer, cards: toOffer(cards) });
}

/** Guarda la autoevaluación de una entrega revisada sin IA: notas y puntos cubiertos. */
export async function saveSelfAssessment(input: unknown): Promise<ActionResult<{ saved: true }>> {
  const parsed = SelfAssessmentInput.safeParse(input);
  if (!parsed.success) return fail('invalid_input');
  const { submissionId, scores, points } = parsed.data;

  const session = await requireUser();
  if (!session.ok) return fail('unauthorized');

  const assessment: SelfAssessment = { kind: 'self', scores, points };
  const { data, error } = await session.supabase
    .from('writing_submissions')
    .update({ feedback: toJson(assessment) })
    .eq('id', submissionId)
    // Solo las entregas sin IA: la corrección de la IA no se puede sobrescribir desde aquí.
    .eq('review_kind', 'self')
    .select('id');
  if (error) return fail('internal');
  if (data.length === 0) return fail('not_found');
  return ok({ saved: true });
}

/** Guarda la reescritura de una entrega (07-writing §2.2, paso 5). */
export async function saveRewrite(input: unknown): Promise<ActionResult<{ words: number }>> {
  const parsed = RewriteInput.safeParse(input);
  if (!parsed.success) return fail('invalid_input');
  const { submissionId, text } = parsed.data;

  const session = await requireUser();
  if (!session.ok) return fail('unauthorized');

  const { data, error } = await session.supabase
    .from('writing_submissions')
    .update({ rewrite_text: text, rewritten_at: new Date().toISOString() })
    .eq('id', submissionId)
    .eq('status', 'done')
    .select('id');
  if (error) return fail('internal');
  if (data.length === 0) return fail('not_found');
  return ok({ words: countWords(text) });
}

/** Añade al repaso, como tarjetas de gramática, los errores elegidos de una entrega. */
export async function addWritingCards(input: unknown): Promise<ActionResult<{ added: number }>> {
  const parsed = CardsInput.safeParse(input);
  if (!parsed.success) return fail('invalid_input');

  const session = await requireUser();
  if (!session.ok) return fail('unauthorized');

  const { data, error } = await session.supabase
    .from('writing_submissions')
    .select('id, text, prompt_id, task_type, feedback')
    .eq('id', parsed.data.submissionId)
    .eq('status', 'done')
    .maybeSingle();
  if (error) return fail('internal');
  if (!data) return fail('not_found');

  const candidates = cardCandidates({
    id: data.id,
    text: data.text,
    promptId: data.prompt_id,
    taskType: data.task_type,
    feedback: parseStoredFeedback(data.feedback),
  });
  const cards = [...new Set(parsed.data.items)].flatMap((index) => {
    const candidate = candidates[index];
    return candidate ? [candidate.card] : [];
  });
  if (cards.length === 0) return fail('invalid_input');

  const result = await insertCards(session.supabase, cards, languageOfId(data.prompt_id ?? ''));
  if (!result) return fail('internal');
  return ok(result);
}
