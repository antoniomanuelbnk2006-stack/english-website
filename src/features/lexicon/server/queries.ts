import 'server-only';
import { cache } from 'react';
import type { CefrLevel } from '@/features/level/lib/bands';
import {
  coverage,
  knownLemmas,
  type CountableToken,
  type LexemeStatus,
} from '@/features/lexicon/lib/known';
import type { LexiconSnapshot } from '@/features/lexicon/components/use-lexicon-session';
import { getProfile } from '@/features/profile/server/queries';
import { getExistingCardKeys } from '@/features/srs/server/queries';
import { getSessionOrRedirect } from '@/lib/auth';
import type { LessonMeta } from '@/lib/content/index';
import { levelOfLemma } from '@/lib/content/levels';
import { lessonTokenCounts } from '@/lib/content/tokens';
import type { Enums } from '@/lib/supabase/database.types';

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

const PAGE = 1000;

/**
 * Todo el léxico personal (lema → estado), para calcular la cobertura de muchos textos a la
 * vez. Se pide por páginas porque la API devuelve como mucho 1.000 filas por consulta.
 */
export const getLexiconMap = cache(async (): Promise<Map<string, LexemeStatus>> => {
  const { supabase } = await getSessionOrRedirect();
  const all = new Map<string, LexemeStatus>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('lexicon')
      .select('lemma, status')
      .order('lemma')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`No se pudo leer el léxico: ${error.message}`);
    for (const row of data) all.set(row.lemma, row.status);
    if (data.length < PAGE) break;
  }
  return all;
});

export interface LexiconFilter {
  status?: LexemeStatus;
  level?: CefrLevel;
  search?: string;
  page: number;
}

export interface LexiconEntry {
  lemma: string;
  status: LexemeStatus;
  source: Enums<'lexeme_source'>;
  cefr: CefrLevel | null;
  seenCount: number;
  lookupCount: number;
  /** Próximo repaso, si la palabra tiene tarjeta activa. */
  nextReview: string | null;
}

export const LEXICON_PAGE_SIZE = 50;

/** Una página del léxico, con el próximo repaso de cada palabra. */
export async function getLexiconPage(
  filter: LexiconFilter,
): Promise<{ entries: LexiconEntry[]; total: number }> {
  const { supabase } = await getSessionOrRedirect();
  const from = (filter.page - 1) * LEXICON_PAGE_SIZE;

  let query = supabase
    .from('lexicon')
    .select('lemma, status, source, cefr, seen_count, lookup_count', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .order('lemma')
    .range(from, from + LEXICON_PAGE_SIZE - 1);
  if (filter.status) query = query.eq('status', filter.status);
  if (filter.level) query = query.eq('cefr', filter.level);
  // Búsqueda por el principio del lema; los comodines que escriba el usuario se descartan.
  const prefix = filter.search?.replace(/[%_*\\]/g, '').trim();
  if (prefix) query = query.ilike('lemma', `${prefix}%`);

  const { data, error, count } = await query;
  if (error) throw new Error(`No se pudo leer el léxico: ${error.message}`);

  const lemmas = data.map((row) => row.lemma);
  const due = new Map<string, string>();
  if (lemmas.length > 0) {
    const { data: cards, error: cardsError } = await supabase
      .from('srs_cards')
      .select('lemma, due')
      .eq('suspended', false)
      .in('lemma', lemmas);
    if (cardsError) throw new Error(`No se pudieron leer las tarjetas: ${cardsError.message}`);
    for (const card of cards) {
      if (!card.lemma) continue;
      const current = due.get(card.lemma);
      if (!current || card.due < current) due.set(card.lemma, card.due);
    }
  }

  return {
    entries: data.map((row) => ({
      lemma: row.lemma,
      status: row.status,
      source: row.source,
      cefr: row.cefr,
      seenCount: row.seen_count,
      lookupCount: row.lookup_count,
      nextReview: due.get(row.lemma) ?? null,
    })),
    total: count ?? data.length,
  };
}

/** Cuántas palabras hay en cada estado. */
export async function getLexiconCounts(): Promise<Record<LexemeStatus, number>> {
  const counts: Record<LexemeStatus, number> = { new: 0, learning: 0, known: 0, ignored: 0 };
  for (const status of (await getLexiconMap()).values()) counts[status]++;
  return counts;
}

/** Lo que una lección necesita saber del usuario: niveles, estados y tarjetas de sus palabras. */
export async function getLexiconSnapshot(lesson: {
  id: string;
  lemmas: readonly string[];
  glossary: readonly { lemma: string }[];
}): Promise<LexiconSnapshot> {
  const glossaryLemmas = lesson.glossary.map((entry) => entry.lemma);
  const lemmas = [...new Set([...lesson.lemmas, ...glossaryLemmas])];
  const [statuses, userLevel, cardKeys] = await Promise.all([
    getLexiconStatus(lemmas),
    getUserLevel(),
    getExistingCardKeys(lesson.id, glossaryLemmas),
  ]);
  return {
    userLevel,
    levels: Object.fromEntries(
      lemmas.flatMap((lemma) => {
        const level = levelOfLemma(lemma);
        return level ? [[lemma, level]] : [];
      }),
    ),
    statuses: Object.fromEntries(statuses),
    cardKeys: [...cardKeys],
  };
}

/**
 * Cobertura léxica de cada lección para el usuario («para ti: 96 %»), de 0 a 1. Se calcula en
 * el servidor con todo su léxico: cambia en cuanto marca una palabra.
 */
export async function getCoverageByLesson(
  lessons: readonly Pick<LessonMeta, 'id' | 'version' | 'path'>[],
): Promise<Map<string, number>> {
  const [lexicon, userLevel] = await Promise.all([getLexiconMap(), getUserLevel()]);
  const context = {
    statusOf: (lemma: string) => lexicon.get(lemma),
    levelOf: levelOfLemma,
    userLevel,
  };
  return new Map(
    lessons.map((lesson) => {
      const tokens = lessonTokenCounts(lesson);
      return [lesson.id, coverage(tokens, knownLemmas(tokens, context))];
    }),
  );
}
