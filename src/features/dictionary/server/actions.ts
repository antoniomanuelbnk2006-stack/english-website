'use server';

import { z } from 'zod';
import { buildLookupCard, LookupTerm } from '@/features/dictionary/lib/wiktionary';
import { lookupWord } from '@/features/dictionary/server/lookup';
import { getPracticeLanguage } from '@/features/profile/server/queries';
import { buildDictionaryCard, type NewCard } from '@/features/srs/lib/cards';
import { insertCards } from '@/features/srs/server/cards';
import { fail, ok, type ActionResult } from '@/lib/actions';
import { requireUser } from '@/lib/auth';
import { findDictionaryEntry } from '@/lib/content/dictionary';
import type { PracticeLanguage } from '@/lib/content/language';
import { lemmaKey } from '@/lib/content/dictionary-schema';
import { levelOfLemma } from '@/lib/content/levels';
import type { SupabaseServerClient } from '@/lib/supabase/server';
import { getLocale } from '@/lib/i18n/server';

const AddInput = z.object({
  lemmas: z.array(z.string().trim().min(1).max(80)).min(1).max(40),
});

/**
 * Manda al repaso palabras del mazo. La tarjeta la monta el servidor con la entrada del mazo:
 * del cliente solo llega qué palabra. Una palabra que ya tenía tarjeta en pausa (por haberla
 * dado por conocida) vuelve al repaso.
 */
export async function addDictionaryWords(input: unknown): Promise<ActionResult<{ added: number }>> {
  const parsed = AddInput.safeParse(input);
  if (!parsed.success) return fail('invalid_input');

  const session = await requireUser();
  if (!session.ok) return fail('unauthorized');
  const { supabase } = session;

  const [locale, language] = await Promise.all([getLocale(), getPracticeLanguage()]);
  const entries = [...new Set(parsed.data.lemmas.map(lemmaKey))].flatMap((lemma) => {
    const found = findDictionaryEntry(lemma, locale, language);
    return found ? [found.entry] : [];
  });
  if (entries.length === 0) return fail('not_found');

  const result = await sendToReview(supabase, entries.map(buildDictionaryCard), language);
  return result ? ok(result) : fail('internal');
}

/**
 * Crea las tarjetas que falten, reactiva las que estuvieran en pausa y deja sus palabras como
 * «aprendiendo». Devuelve `null` si falla la base de datos.
 */
async function sendToReview(
  supabase: SupabaseServerClient,
  cards: NewCard[],
  language: PracticeLanguage,
): Promise<{ added: number } | null> {
  const keys = cards.flatMap((card) => (card.lemma ? [card.lemma] : []));
  const result = await insertCards(supabase, cards, language);
  if (!result) return null;

  const { error: resumeError } = await supabase
    .from('srs_cards')
    .update({ suspended: false })
    .eq('language', language)
    .in('lemma', keys)
    .eq('suspended', true);
  if (resumeError) return null;

  const { error: lexiconError } = await supabase.from('lexicon').upsert(
    keys.map((lemma) => ({
      language,
      lemma,
      status: 'learning' as const,
      source: 'srs' as const,
      cefr: levelOfLemma(lemma, language) ?? null,
    })),
    { onConflict: 'user_id,language,lemma' },
  );
  return lexiconError ? null : result;
}

const LookupInput = z.object({ word: LookupTerm });

/**
 * Manda al repaso una palabra buscada en el diccionario completo. Si está en el mazo, se usa
 * su entrada (traducción y ejemplo cuidados); si no, la tarjeta se monta con lo que devuelve
 * Wiktionary, que el servidor vuelve a consultar: del cliente solo llega la palabra.
 */
export async function addLookupWord(input: unknown): Promise<ActionResult<{ added: number }>> {
  const parsed = LookupInput.safeParse(input);
  if (!parsed.success) return fail('invalid_input');

  const session = await requireUser();
  if (!session.ok) return fail('unauthorized');

  const language = await getPracticeLanguage();
  const curated = findDictionaryEntry(parsed.data.word, await getLocale(), language);
  let card: NewCard;
  if (curated) {
    card = buildDictionaryCard(curated.entry);
  } else {
    const found = await lookupWord(parsed.data.word);
    if (found.status === 'not_found') return fail('not_found');
    if (found.status === 'unavailable') return fail('internal');
    card = buildLookupCard(found.entry);
  }

  const result = await sendToReview(session.supabase, [card], language);
  return result ? ok(result) : fail('internal');
}
