import 'server-only';
import type { NewCard } from '@/features/srs/lib/cards';
import { newCardState } from '@/features/srs/lib/scheduler';
import { levelOfLemma } from '@/lib/content/levels';
import type { Json } from '@/lib/supabase/database.types';
import type { SupabaseServerClient } from '@/lib/supabase/server';

const toJson = (value: unknown): Json => JSON.parse(JSON.stringify(value)) as Json;

/**
 * Inserta las tarjetas que aún no existan y deja sus palabras como «aprendiendo» en el
 * léxico. Devuelve cuántas se han creado. Devuelve `null` si falla la base de datos.
 */
export async function insertCards(
  supabase: SupabaseServerClient,
  cards: readonly NewCard[],
): Promise<{ added: number } | null> {
  if (cards.length === 0) return { added: 0 };

  const lemmas = cards.flatMap((card) => (card.lemma ? [card.lemma] : []));
  const sources = cards.map((card) => card.source_segment_id);
  const [byLemma, bySource] = await Promise.all([
    lemmas.length > 0
      ? supabase.from('srs_cards').select('kind, lemma').in('lemma', lemmas)
      : Promise.resolve({ data: [], error: null }),
    supabase.from('srs_cards').select('kind, source_segment_id').in('source_segment_id', sources),
  ]);
  if (byLemma.error || bySource.error) return null;

  // Una palabra tiene una sola tarjeta; un fragmento o un ítem de gramática, también.
  const taken = new Set([
    ...(byLemma.data ?? []).map((card) => `${card.kind}:${card.lemma}`),
    ...(bySource.data ?? []).map((card) => `${card.kind}:${card.source_segment_id}`),
  ]);
  const fresh = cards.filter(
    (card) =>
      !taken.has(`${card.kind}:${card.source_segment_id}`) &&
      !(card.lemma && taken.has(`${card.kind}:${card.lemma}`)),
  );
  if (fresh.length === 0) return { added: 0 };

  const now = new Date();
  const { error } = await supabase.from('srs_cards').insert(
    fresh.map((card) => ({
      kind: card.kind,
      lemma: card.lemma,
      front: toJson(card.front),
      back: toJson(card.back),
      source_lesson_id: card.source_lesson_id,
      source_segment_id: card.source_segment_id,
      due: newCardState(now).due,
    })),
  );
  if (error) return null;

  const learning = [...new Set(fresh.flatMap((card) => (card.lemma ? [card.lemma] : [])))];
  if (learning.length > 0) {
    const { error: lexiconError } = await supabase.from('lexicon').upsert(
      learning.map((lemma) => ({
        lemma,
        status: 'learning' as const,
        source: 'srs' as const,
        cefr: levelOfLemma(lemma) ?? null,
      })),
      { onConflict: 'user_id,lemma' },
    );
    if (lexiconError) return null;
  }
  return { added: fresh.length };
}
