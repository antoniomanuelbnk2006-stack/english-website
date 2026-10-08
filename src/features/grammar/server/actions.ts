'use server';

import { z } from 'zod';
import { gradePractice, type PracticeItemResult } from '@/features/grammar/lib/practice';
import { bandCenter, DEFAULT_RATING } from '@/features/level/lib/bands';
import { buildGrammarCard } from '@/features/srs/lib/cards';
import { insertCards } from '@/features/srs/server/cards';
import { fail, ok, type ActionResult } from '@/lib/actions';
import { requireUser } from '@/lib/auth';
import { findFicha } from '@/lib/content/grammar';
import { GrammarId } from '@/lib/content/schema';
import type { Json } from '@/lib/supabase/database.types';

const toJson = (value: unknown): Json => JSON.parse(JSON.stringify(value)) as Json;

// El progreso de una ficha se guarda en `lesson_progress` con el id de la ficha
// (`b1.linkers`): «started» al abrirla, «completed» y nota al hacer la mini-práctica.

const SeenInput = z.object({ grammarId: GrammarId });

/** Anota que la ficha se ha abierto (estado «vista»). */
export async function markFichaSeen(input: unknown): Promise<ActionResult<null>> {
  const parsed = SeenInput.safeParse(input);
  if (!parsed.success) return fail('invalid_input');

  const session = await requireUser();
  if (!session.ok) return fail('unauthorized');
  if (!findFicha(parsed.data.grammarId)) return fail('not_found');

  const { error } = await session.supabase
    .from('lesson_progress')
    .upsert(
      { lesson_id: parsed.data.grammarId },
      { onConflict: 'user_id,lesson_id', ignoreDuplicates: true },
    );
  if (error) return fail('internal');
  return ok(null);
}

const PracticeInput = z.object({
  grammarId: GrammarId,
  answers: z
    .array(
      z.object({
        itemId: z.string().regex(/^p\d{1,2}$/),
        text: z.string().max(120),
        durationMs: z.number().int().min(0).max(3_600_000),
        clientId: z.uuid(),
      }),
    )
    .min(1)
    .max(10),
});

export interface PracticeResult {
  items: PracticeItemResult[];
  score: number;
  /** Tarjetas de gramática creadas con los ítems fallados. */
  cardsAdded: number;
}

/**
 * Corrige la mini-práctica de una ficha, guarda los intentos y el progreso, y da de alta en el
 * repaso los ítems fallados.
 */
export async function submitPractice(input: unknown): Promise<ActionResult<PracticeResult>> {
  const parsed = PracticeInput.safeParse(input);
  if (!parsed.success) return fail('invalid_input');
  const { grammarId, answers } = parsed.data;

  const session = await requireUser();
  if (!session.ok) return fail('unauthorized');
  const { supabase } = session;

  const ficha = findFicha(grammarId);
  if (!ficha) return fail('not_found');
  const { meta } = ficha;

  const { results, score } = gradePractice(
    meta.practice,
    new Map(answers.map((answer) => [answer.itemId, answer.text])),
  );

  const { data: ratingRow, error: ratingError } = await supabase
    .from('skill_ratings')
    .select('rating')
    .eq('skill', 'grammar')
    .maybeSingle();
  if (ratingError) return fail('internal');

  const byItem = new Map(answers.map((answer) => [answer.itemId, answer]));
  const rows = results.flatMap((result) => {
    const answer = byItem.get(result.itemId);
    if (!answer) return [];
    return [
      {
        item_id: `${meta.id}:${result.itemId}`,
        skill: 'grammar',
        task_type: 'gap_fill',
        focus: 'grammar',
        phase: 'practice',
        item_difficulty: bandCenter(meta.level),
        rating_before: ratingRow?.rating ?? DEFAULT_RATING,
        score: result.correct ? 1 : 0,
        response: { type: 'short_answer', text: answer.text },
        duration_ms: answer.durationMs,
        client_id: answer.clientId,
      },
    ];
  });

  const { error: applyError } = await supabase.rpc('apply_lesson_attempts', {
    p_lesson_id: meta.id,
    p_lesson_version: 1,
    p_attempts: toJson(rows),
    p_ratings: {},
    p_progress: toJson({ status: 'completed', phase: 1, score, time_spent_s: 0 }),
  });
  if (applyError) return fail('internal');

  const failed = results.filter((result) => !result.correct).map((result) => result.itemId);
  const cards = meta.practice
    .filter((item) => failed.includes(item.id))
    .map((item) => buildGrammarCard(meta, item));
  const inserted = await insertCards(supabase, cards);
  if (!inserted) return fail('internal');

  return ok({ items: results, score, cardsAdded: inserted.added });
}
