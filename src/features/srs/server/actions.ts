'use server';

import { z } from 'zod';
import { transcriptUnlocked } from '@/features/listening/lib/views';
import { buildAudioCard, buildWordCard } from '@/features/srs/lib/cards';
import { Grade, isMature, review, type CardState } from '@/features/srs/lib/scheduler';
import { insertCards } from '@/features/srs/server/cards';
import { toCardState } from '@/features/srs/server/queries';
import { fail, ok, type ActionResult } from '@/lib/actions';
import { requireUser } from '@/lib/auth';
import { levelOfLemma } from '@/lib/content/levels';
import { loadLesson } from '@/lib/content/loader';
import { LessonId, SegmentId } from '@/lib/content/schema';
import type { Json } from '@/lib/supabase/database.types';
import { languageOfId } from '@/lib/content/language';
import type { PracticeLanguage } from '@/lib/content/language';

const toJson = (value: unknown): Json => JSON.parse(JSON.stringify(value)) as Json;

const AddCardsInput = z.object({
  lessonId: LessonId,
  items: z
    .array(
      z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('word'), lemma: z.string().trim().min(1).max(80) }),
        z.object({ kind: z.literal('audio'), segmentId: SegmentId }),
      ]),
    )
    .min(1)
    .max(20),
});

/**
 * Crea tarjetas a partir de una lección: palabras o expresiones de su glosario y fragmentos de
 * audio. El contenido de cada tarjeta lo monta el servidor a partir de la lección.
 */
export async function addCards(input: unknown): Promise<ActionResult<{ added: number }>> {
  const parsed = AddCardsInput.safeParse(input);
  if (!parsed.success) return fail('invalid_input');

  const session = await requireUser();
  if (!session.ok) return fail('unauthorized');
  const { supabase } = session;

  const lesson = await loadLesson(parsed.data.lessonId);
  if (!lesson) return fail('not_found');

  // Las tarjetas de una lección de escucha llevan su guion: solo cuando ya se puede ver.
  if (lesson.skill === 'listening') {
    const { data: progress, error } = await supabase
      .from('lesson_progress')
      .select('phase, transcript_first')
      .eq('lesson_id', lesson.id)
      .maybeSingle();
    if (error) return fail('internal');
    if (!transcriptUnlocked(progress)) return fail('conflict');
  }

  const cards = parsed.data.items.flatMap((item) => {
    const card =
      item.kind === 'audio'
        ? buildAudioCard(lesson, item.segmentId)
        : buildWordCard(lesson, item.lemma.toLowerCase());
    return card ? [card] : [];
  });
  if (cards.length === 0) return fail('invalid_input');

  const result = await insertCards(supabase, cards, languageOfId(lesson.id));
  if (!result) return fail('internal');
  return ok(result);
}

const SubmitReviewsInput = z.object({
  reviews: z
    .array(
      z.object({
        cardId: z.uuid(),
        grade: Grade,
        reviewedAt: z.iso.datetime(),
        durationMs: z.number().int().min(0).max(600_000),
        clientId: z.uuid(),
      }),
    )
    .min(1)
    .max(50),
});

/** Margen por si el reloj del dispositivo va algo adelantado. */
const CLOCK_SKEW_MS = 5_000;

/**
 * Guarda un lote de repasos. El estado nuevo de cada tarjeta se vuelve a calcular aquí con
 * ts-fsrs a partir del estado guardado: del cliente solo se aceptan la valoración y la hora.
 * Es idempotente por `clientId`.
 */
export async function submitReviews(input: unknown): Promise<ActionResult<{ applied: number }>> {
  const parsed = SubmitReviewsInput.safeParse(input);
  if (!parsed.success) return fail('invalid_input');

  const session = await requireUser();
  if (!session.ok) return fail('unauthorized');
  const { supabase } = session;

  const reviews = [...parsed.data.reviews].sort((a, b) => a.reviewedAt.localeCompare(b.reviewedAt));
  const cardIds = [...new Set(reviews.map((r) => r.cardId))];

  const [cards, seen] = await Promise.all([
    supabase
      .from('srs_cards')
      .select(
        'id, lemma, language, due, stability, difficulty, elapsed_days, scheduled_days, learning_steps, reps, lapses, state, last_review',
      )
      .in('id', cardIds),
    supabase
      .from('srs_reviews')
      .select('client_id')
      .in(
        'client_id',
        reviews.map((r) => r.clientId),
      ),
  ]);
  if (cards.error || seen.error) return fail('internal');

  const states = new Map<string, CardState>(cards.data.map((row) => [row.id, toCardState(row)]));
  const lemmaOf = new Map(cards.data.map((row) => [row.id, row.lemma]));
  const languageOf = new Map(cards.data.map((row) => [row.id, row.language as PracticeLanguage]));
  const already = new Set(seen.data.map((row) => row.client_id));
  const now = Date.now() + CLOCK_SKEW_MS;

  const payload: unknown[] = [];
  for (const item of reviews) {
    const state = states.get(item.cardId);
    // Tarjeta ajena o borrada, o repaso ya guardado en un envío anterior.
    if (!state || already.has(item.clientId)) continue;

    // Ni en el futuro ni antes del repaso anterior de esa misma tarjeta.
    const earliest = state.last_review ? new Date(state.last_review).getTime() : 0;
    const at = new Date(Math.max(earliest, Math.min(now, new Date(item.reviewedAt).getTime())));

    const next = review(state, item.grade, at);
    states.set(item.cardId, next.state);
    already.add(item.clientId);
    payload.push({
      card_id: item.cardId,
      client_id: item.clientId,
      duration_ms: item.durationMs,
      card: next.state,
      log: next.log,
    });
  }
  if (payload.length === 0) return ok({ applied: 0 });

  const { data: applied, error } = await supabase.rpc('apply_reviews', {
    p_reviews: toJson(payload),
  });
  if (error) return fail('internal');

  // El léxico sigue al repaso: una tarjeta que llega a intervalos largos da la palabra por
  // conocida; si después se olvida, vuelve a «aprendiendo».
  const touched = new Set(reviews.map((r) => r.cardId));
  // Cada palabra, en el léxico del idioma de su tarjeta.
  const updates = new Map<
    string,
    { status: 'known' | 'learning'; language: PracticeLanguage; lemmas: Set<string> }
  >();
  for (const cardId of touched) {
    const lemma = lemmaOf.get(cardId);
    const language = languageOf.get(cardId);
    const state = states.get(cardId);
    if (!lemma || !language || !state) continue;
    const status = isMature(state) ? 'known' : 'learning';
    const group = updates.get(`${status}:${language}`) ?? { status, language, lemmas: new Set() };
    group.lemmas.add(lemma);
    updates.set(`${status}:${language}`, group);
  }
  for (const { status, language, lemmas } of updates.values()) {
    const { error: lexiconError } = await supabase.from('lexicon').upsert(
      [...lemmas].map((lemma) => ({
        language,
        lemma,
        status,
        source: 'srs' as const,
        cefr: levelOfLemma(lemma, language) ?? null,
      })),
      { onConflict: 'user_id,language,lemma' },
    );
    if (lexiconError) return fail('internal');
  }

  return ok({ applied: applied ?? payload.length });
}
