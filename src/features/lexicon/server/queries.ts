import 'server-only';
import type { CefrLevel } from '@/features/level/lib/bands';
import { knownLemmas, type CountableToken, type LexemeStatus } from '@/features/lexicon/lib/known';
import { getProfile } from '@/features/profile/server/queries';
import { getSessionOrRedirect } from '@/lib/auth';
import { levelOfLemma } from '@/lib/content/levels';

/** Estado en el léxico personal de los lemas indicados (los que no estén, no aparecen). */
export async function getLexiconStatus(
  lemmas: readonly string[],
): Promise<Map<string, LexemeStatus>> {
  if (lemmas.length === 0) return new Map();
  const { supabase } = await getSessionOrRedirect();
  const { data, error } = await supabase
    .from('lexicon')
    .select('lemma, status')
    .in('lemma', [...new Set(lemmas)]);
  if (error) throw new Error(`No se pudo leer el léxico: ${error.message}`);
  return new Map(data.map((row) => [row.lemma, row.status]));
}

/** Nivel del usuario mientras no haya niveles confirmados: el declarado, o B1. */
export async function getUserLevel(): Promise<CefrLevel> {
  return (await getProfile()).declaredLevel ?? 'B1';
}

/** Lemas de un texto que el usuario conoce, según su léxico y su nivel. */
export async function getKnownLemmas(tokens: readonly CountableToken[]): Promise<Set<string>> {
  const lemmas = [...new Set(tokens.filter((token) => token.w).map((token) => token.l))];
  const [status, userLevel] = await Promise.all([getLexiconStatus(lemmas), getUserLevel()]);
  return knownLemmas(tokens, {
    statusOf: (lemma) => status.get(lemma),
    levelOf: levelOfLemma,
    userLevel,
  });
}
