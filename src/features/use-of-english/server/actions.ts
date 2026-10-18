'use server';

import { z } from 'zod';
import { bandCenter, DEFAULT_RATING } from '@/features/level/lib/bands';
import { buildUoeCard } from '@/features/srs/lib/cards';
import { insertCards } from '@/features/srs/server/cards';
import { gradeUoe, type UoeResult } from '@/features/use-of-english/lib/grade';
import { fail, ok, type ActionResult } from '@/lib/actions';
import { requireUser } from '@/lib/auth';
import { findUoeSet } from '@/lib/content/uoe';
import { UoeId } from '@/lib/content/uoe-schema';
import type { Json } from '@/lib/supabase/database.types';
import { getLocale } from '@/lib/i18n/server';
import { languageOfId } from '@/lib/content/language';

const toJson = (value: unknown): Json => JSON.parse(JSON.stringify(value)) as Json;

// El progreso de un ejercicio se guarda en `lesson_progress` con su id (`b2-uoe-001`) y sus
// respuestas en `item_attempts` con `skill = 'grammar'`, igual que las fichas de gramática.

const SubmitInput = z.object({
  setId: UoeId,
  version: z.number().int().positive(),
  answers: z
    .array(
      z.object({
        n: z.number().int().positive().max(20),
        /** Texto escrito, o el índice de la opción en la parte 1. */
        value: z.union([z.string().max(160), z.number().int().min(0).max(3)]),
        clientId: z.uuid(),
      }),
    )
    .min(1)
    .max(20),
  durationMs: z.number().int().min(0).max(7_200_000),
});

/**
 * Corrige un ejercicio de Use of English con los criterios del examen y guarda intentos y
 * progreso. Las respuestas y las explicaciones solo salen del servidor aquí, ya corregidas.
 */
export async function submitUoe(input: unknown): Promise<ActionResult<UoeResult>> {
  const parsed = SubmitInput.safeParse(input);
  if (!parsed.success) return fail('invalid_input');
  const { setId, version, answers, durationMs } = parsed.data;

  const session = await requireUser();
  if (!session.ok) return fail('unauthorized');
  const { supabase } = session;

  const set = findUoeSet(setId, await getLocale());
  if (!set) return fail('not_found');
  if (set.version !== version) return fail('conflict');

  const result = gradeUoe(set, Object.fromEntries(answers.map((a) => [a.n, a.value])));

  const language = languageOfId(set.id);
  const { data: ratingRow, error: ratingError } = await supabase
    .from('skill_ratings')
    .select('rating')
    .eq('language', language)
    .eq('skill', 'grammar')
    .maybeSingle();
  if (ratingError) return fail('internal');

  const clientIds = new Map(answers.map((answer) => [answer.n, answer.clientId]));
  const perItem = Math.round(durationMs / Math.max(1, result.items.length));
  const rows = result.items.flatMap((item) => {
    const clientId = clientIds.get(item.n);
    // Lo que se dejó en blanco no es un intento: no se guarda.
    if (!clientId || item.given === '') return [];
    return [
      {
        item_id: `${set.id}:${item.n}`,
        skill: 'grammar',
        task_type: set.part,
        focus: 'use_of_english',
        phase: 'practice',
        item_difficulty: bandCenter(set.level),
        rating_before: ratingRow?.rating ?? DEFAULT_RATING,
        score: item.marks / item.max,
        response: { type: 'short_answer', text: item.given },
        duration_ms: perItem,
        client_id: clientId,
      },
    ];
  });

  const { error } = await supabase.rpc('apply_lesson_attempts', {
    p_lesson_id: set.id,
    p_language: language,
    p_lesson_version: set.version,
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

  return ok(result);
}

/** Como mucho, estos fallos por ejercicio pasan al repaso (igual que en la cosecha). */
const MAX_CARDS_PER_SET = 5;

const CardsInput = z.object({
  setId: UoeId,
  items: z.array(z.number().int().positive().max(20)).min(1).max(MAX_CARDS_PER_SET),
});

/** Añade al repaso, como tarjetas de gramática, los huecos o frases que se quieran repasar. */
export async function addUoeCards(input: unknown): Promise<ActionResult<{ added: number }>> {
  const parsed = CardsInput.safeParse(input);
  if (!parsed.success) return fail('invalid_input');

  const session = await requireUser();
  if (!session.ok) return fail('unauthorized');

  const set = findUoeSet(parsed.data.setId, await getLocale());
  if (!set) return fail('not_found');

  const cards = [...new Set(parsed.data.items)].flatMap((n) => {
    const card = buildUoeCard(set, n);
    return card ? [card] : [];
  });
  if (cards.length === 0) return fail('invalid_input');

  const result = await insertCards(session.supabase, cards, languageOfId(set.id));
  if (!result) return fail('internal');
  return ok(result);
}
