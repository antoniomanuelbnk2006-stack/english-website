'use server';

import { z } from 'zod';
import { bandCenter, DEFAULT_RATING } from '@/features/level/lib/bands';
import { fail, ok, type ActionResult } from '@/lib/actions';
import { requireUser } from '@/lib/auth';
import { findPronunciationSet } from '@/lib/content/pronunciation';
import { PronunciationId } from '@/lib/content/pronunciation-schema';
import type { Json } from '@/lib/supabase/database.types';
import { getLocale } from '@/lib/i18n/server';
import { languageOfId } from '@/lib/content/language';

const toJson = (value: unknown): Json => JSON.parse(JSON.stringify(value)) as Json;

// El progreso de un ejercicio se guarda en `lesson_progress` con su id (`a1-pro-001`) y cada
// ítem en `item_attempts` con `skill = 'speaking'`. La nota la pone el reconocimiento de voz
// del navegador, que no es un juez fiable: sirve para ver tu progreso, pero no mueve el nivel
// estimado ni da XP.

const SaveInput = z.object({
  setId: PronunciationId,
  version: z.number().int().positive(),
  results: z
    .array(
      z.object({
        itemId: z.string().regex(/^i\d{1,2}$/),
        /** Mejor resultado del ítem: parte de las palabras entendidas. */
        score: z.number().min(0).max(1),
        attempts: z.number().int().min(1).max(99),
        heard: z.string().max(200),
        clientId: z.uuid(),
      }),
    )
    .min(1)
    .max(16),
  durationMs: z.number().int().min(0).max(7_200_000),
});

/** Guarda el resultado de un ejercicio de pronunciación. Devuelve la nota del ejercicio. */
export async function savePronunciation(input: unknown): Promise<ActionResult<{ score: number }>> {
  const parsed = SaveInput.safeParse(input);
  if (!parsed.success) return fail('invalid_input');
  const { setId, version, results, durationMs } = parsed.data;

  const session = await requireUser();
  if (!session.ok) return fail('unauthorized');
  const { supabase } = session;

  const set = findPronunciationSet(setId, await getLocale());
  if (!set) return fail('not_found');
  if (set.version !== version) return fail('conflict');

  const itemIds = new Set(set.items.map((item) => item.id));
  const valid = [...new Map(results.map((result) => [result.itemId, result])).values()].filter(
    (result) => itemIds.has(result.itemId),
  );
  if (valid.length === 0) return fail('invalid_input');

  const language = languageOfId(set.id);
  const { data: ratingRow, error: ratingError } = await supabase
    .from('skill_ratings')
    .select('rating')
    .eq('language', language)
    .eq('skill', 'speaking')
    .maybeSingle();
  if (ratingError) return fail('internal');

  // Lo que no se ha intentado cuenta como cero: la nota es sobre el ejercicio entero.
  const score = valid.reduce((sum, result) => sum + result.score, 0) / set.items.length;
  const perItem = Math.round(durationMs / valid.length);

  const { error } = await supabase.rpc('apply_lesson_attempts', {
    p_lesson_id: set.id,
    p_language: language,
    p_lesson_version: set.version,
    p_attempts: toJson(
      valid.map((result) => ({
        item_id: `${set.id}:${result.itemId}`,
        skill: 'speaking',
        task_type: 'pronunciation',
        focus: set.focus,
        phase: 'practice',
        item_difficulty: bandCenter(set.level),
        rating_before: ratingRow?.rating ?? DEFAULT_RATING,
        score: result.score,
        response: { type: 'speech', heard: result.heard, attempts: result.attempts },
        duration_ms: perItem,
        client_id: result.clientId,
      })),
    ),
    p_ratings: {},
    p_progress: toJson({
      status: 'completed',
      phase: 1,
      score,
      time_spent_s: Math.round(durationMs / 1000),
    }),
  });
  if (error) return fail('internal');

  return ok({ score });
}
