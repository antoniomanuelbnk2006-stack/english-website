'use server';

import { z } from 'zod';
import { buildDictionaryCard } from '@/features/srs/lib/cards';
import { insertCards } from '@/features/srs/server/cards';
import { fail, ok, type ActionResult } from '@/lib/actions';
import { requireUser } from '@/lib/auth';
import { findDictionaryEntry } from '@/lib/content/dictionary';
import { lemmaKey } from '@/lib/content/dictionary-schema';
import { levelOfLemma } from '@/lib/content/levels';

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

  const entries = [...new Set(parsed.data.lemmas.map(lemmaKey))].flatMap((lemma) => {
    const found = findDictionaryEntry(lemma);
    return found ? [found.entry] : [];
  });
  if (entries.length === 0) return fail('not_found');
  const keys = entries.map((entry) => lemmaKey(entry.lemma));

  const result = await insertCards(supabase, entries.map(buildDictionaryCard));
  if (!result) return fail('internal');

  const { error: resumeError } = await supabase
    .from('srs_cards')
    .update({ suspended: false })
    .in('lemma', keys)
    .eq('suspended', true);
  if (resumeError) return fail('internal');

  const { error: lexiconError } = await supabase.from('lexicon').upsert(
    keys.map((lemma) => ({
      lemma,
      status: 'learning' as const,
      source: 'srs' as const,
      cefr: levelOfLemma(lemma) ?? null,
    })),
    { onConflict: 'user_id,lemma' },
  );
  if (lexiconError) return fail('internal');

  return ok(result);
}
