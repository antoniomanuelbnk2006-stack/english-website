'use server';

import { z } from 'zod';
import { applyExposure } from '@/features/lexicon/lib/exposure';
import { fail, ok, type ActionResult } from '@/lib/actions';
import { requireUser } from '@/lib/auth';
import { levelOfLemma } from '@/lib/content/levels';
import { loadLesson } from '@/lib/content/loader';
import { LessonId } from '@/lib/content/schema';
import { parseSettings } from '@/features/profile/lib/settings';
import { getPracticeLanguage } from '@/features/profile/server/queries';
import { languageOfId } from '@/lib/content/language';

const Lemma = z.string().trim().toLowerCase().min(1).max(80);

const SetStatusInput = z.object({
  lemmas: z.array(Lemma).min(1).max(500),
  /** «learning» no se elige a mano: lo pone el repaso al crear una tarjeta. */
  status: z.enum(['new', 'known', 'ignored']),
});

/**
 * Cambia a mano el estado de una o varias palabras («ya la conozco», «no la conozco»,
 * «ignorar»). Dar una palabra por conocida o ignorada pausa sus tarjetas; volver a marcarla
 * como desconocida las reactiva.
 */
export async function setLexemeStatus(input: unknown): Promise<ActionResult<{ updated: number }>> {
  const parsed = SetStatusInput.safeParse(input);
  if (!parsed.success) return fail('invalid_input');
  const lemmas = [...new Set(parsed.data.lemmas)];
  const { status } = parsed.data;

  const session = await requireUser();
  if (!session.ok) return fail('unauthorized');
  const { supabase } = session;
  // Las palabras son del idioma que se practica (ADR-0037).
  const language = await getPracticeLanguage();

  const { data: cards, error: cardsError } = await supabase
    .from('srs_cards')
    .select('id, lemma')
    .eq('language', language)
    .in('lemma', lemmas);
  if (cardsError) return fail('internal');
  const withCard = new Set(cards.flatMap((card) => (card.lemma ? [card.lemma] : [])));

  const { error } = await supabase.from('lexicon').upsert(
    lemmas.map((lemma) => ({
      language,
      lemma,
      // Una palabra «desconocida» que ya tiene tarjeta sigue en repaso.
      status: status === 'new' && withCard.has(lemma) ? ('learning' as const) : status,
      source: 'manual' as const,
      cefr: levelOfLemma(lemma, language) ?? null,
    })),
    { onConflict: 'user_id,language,lemma' },
  );
  if (error) return fail('internal');

  if (cards.length > 0) {
    const { error: suspendError } = await supabase
      .from('srs_cards')
      .update({ suspended: status !== 'new' })
      .in(
        'id',
        cards.map((card) => card.id),
      );
    if (suspendError) return fail('internal');
  }

  return ok({ updated: lemmas.length });
}

const ExposureInput = z.object({
  lessonId: LessonId,
  /** Lemas consultados en el glosario o marcados como desconocidos durante la lección. */
  lookedUp: z.array(Lemma).max(300).default([]),
  /** Lemas de palabras falladas en el dictado. */
  failed: z.array(Lemma).max(100).default([]),
});

/**
 * Al terminar una lección: anota lo consultado y aplica la promoción implícita a las palabras
 * del léxico que aparecen en ella. Solo cuenta la primera vez que se completa la lección.
 */
export async function recordExposure(
  input: unknown,
): Promise<ActionResult<{ promoted: string[] }>> {
  const parsed = ExposureInput.safeParse(input);
  if (!parsed.success) return fail('invalid_input');

  const session = await requireUser();
  if (!session.ok) return fail('unauthorized');
  const { supabase, user } = session;

  const lesson = await loadLesson(parsed.data.lessonId);
  if (!lesson) return fail('not_found');
  const language = languageOfId(lesson.id);

  const { data: progress, error: progressError } = await supabase
    .from('lesson_progress')
    .select('status, attempts')
    .eq('lesson_id', lesson.id)
    .maybeSingle();
  if (progressError) return fail('internal');
  if (progress?.status !== 'completed') return fail('conflict');
  // Repetir una lección no es encontrarse la palabra en un texto distinto.
  if (progress.attempts > 1) return ok({ promoted: [] });

  // Solo valen lemas que de verdad están en la lección.
  const lessonLemmas = new Set([...lesson.lemmas, ...lesson.glossary.map((g) => g.lemma)]);
  const lookedUp = new Set(parsed.data.lookedUp.filter((lemma) => lessonLemmas.has(lemma)));
  const failed = new Set(parsed.data.failed.filter((lemma) => lessonLemmas.has(lemma)));

  const { data: rows, error: rowsError } = await supabase
    .from('lexicon')
    .select('lemma, status, source, seen_count, lookup_count')
    .eq('language', language)
    .in('lemma', [...lessonLemmas]);
  if (rowsError) return fail('internal');

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('settings')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError) return fail('internal');
  const promote = parseSettings(profile?.settings ?? {}).implicit_promotion;

  // Solo interesan las «nuevas» (candidatas a promoción) y lo consultado o fallado ahora.
  const relevant = rows.filter(
    (row) => row.status === 'new' || lookedUp.has(row.lemma) || failed.has(row.lemma),
  );
  const changes = applyExposure(relevant, { lessonLemmas, lookedUp, failed, promote });
  const existing = new Set(rows.map((row) => row.lemma));
  const sourceOf = new Map(rows.map((row) => [row.lemma, row.source]));

  if (changes.length > 0) {
    const { error } = await supabase.from('lexicon').upsert(
      changes.map((change) => ({
        language,
        lemma: change.lemma,
        status: change.status,
        source: change.source ?? sourceOf.get(change.lemma) ?? ('lesson' as const),
        seen_count: change.seen_count,
        lookup_count: change.lookup_count,
      })),
      { onConflict: 'user_id,language,lemma' },
    );
    if (error) return fail('internal');
  }

  // Lo consultado por primera vez entra en el léxico como «nueva».
  const fresh = [...lookedUp].filter((lemma) => !existing.has(lemma));
  if (fresh.length > 0) {
    const { error } = await supabase.from('lexicon').upsert(
      fresh.map((lemma) => ({
        language,
        lemma,
        status: 'new' as const,
        source: 'lesson' as const,
        cefr: levelOfLemma(lemma, language) ?? null,
        lookup_count: 1,
      })),
      { onConflict: 'user_id,language,lemma', ignoreDuplicates: true },
    );
    if (error) return fail('internal');
  }

  return ok({
    promoted: changes.filter((c) => c.source === 'implicit').map((c) => c.lemma),
  });
}
