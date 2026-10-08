import 'server-only';
import { CardContent } from '@/features/srs/lib/cards';
import {
  buildQueue,
  MAX_DUE,
  NEW_PER_DAY,
  type CardState,
  type CardStateCode,
} from '@/features/srs/lib/scheduler';
import { getSessionOrRedirect } from '@/lib/auth';
import { startOfTodayMadrid } from '@/lib/dates';
import type { Tables } from '@/lib/supabase/database.types';

export interface ReviewCard {
  id: string;
  content: CardContent;
  state: CardState;
  created_at: string;
}

export interface ReviewSession {
  /** Tarjetas de esta sesión, ya ordenadas. */
  cards: ReviewCard[];
  /** Nuevas estrenadas hoy (cuentan para el tope diario). */
  newDoneToday: number;
  /** Tiempo de repaso de hoy antes de esta sesión. */
  spentTodayMs: number;
  /** Tarjetas activas en total: distingue «nada para hoy» de «aún no tienes tarjetas». */
  totalCards: number;
}

const CARD_COLUMNS =
  'id, kind, front, back, due, stability, difficulty, elapsed_days, scheduled_days, learning_steps, reps, lapses, state, last_review, created_at';

type CardRow = Pick<
  Tables<'srs_cards'>,
  | 'id'
  | 'kind'
  | 'front'
  | 'back'
  | 'due'
  | 'stability'
  | 'difficulty'
  | 'elapsed_days'
  | 'scheduled_days'
  | 'learning_steps'
  | 'reps'
  | 'lapses'
  | 'state'
  | 'last_review'
  | 'created_at'
>;

/** Las fechas llegan de Postgres como `+00:00`; aquí siempre se manejan en ISO con `Z`. */
const iso = (value: string) => new Date(value).toISOString();

export function toCardState(
  row: Omit<CardRow, 'id' | 'kind' | 'front' | 'back' | 'created_at'>,
): CardState {
  return {
    due: iso(row.due),
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsed_days,
    scheduled_days: row.scheduled_days,
    learning_steps: row.learning_steps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state as CardStateCode,
    last_review: row.last_review ? iso(row.last_review) : null,
  };
}

/** Una tarjeta cuyo contenido no cumpla el esquema se salta: no debe romper la sesión. */
function toReviewCard(row: CardRow): ReviewCard[] {
  const content = CardContent.safeParse({ kind: row.kind, front: row.front, back: row.back });
  if (!content.success) return [];
  return [
    { id: row.id, content: content.data, state: toCardState(row), created_at: iso(row.created_at) },
  ];
}

/** Lo que toca repasar ahora: vencidas (máx. 200) y las nuevas que quedan hoy. */
export async function getReviewSession(): Promise<ReviewSession> {
  const { supabase } = await getSessionOrRedirect();
  const now = new Date();

  const [due, fresh, today, total] = await Promise.all([
    supabase
      .from('srs_cards')
      .select(CARD_COLUMNS)
      .eq('suspended', false)
      .neq('state', 0)
      .lte('due', now.toISOString())
      .order('due')
      .limit(MAX_DUE),
    supabase
      .from('srs_cards')
      .select(CARD_COLUMNS)
      .eq('suspended', false)
      .eq('state', 0)
      .order('created_at')
      .limit(NEW_PER_DAY),
    supabase
      .from('srs_reviews')
      .select('state, duration_ms')
      .gte('review', startOfTodayMadrid().toISOString()),
    supabase.from('srs_cards').select('id', { count: 'exact', head: true }).eq('suspended', false),
  ]);
  const error = due.error ?? fresh.error ?? today.error ?? total.error;
  if (error) throw new Error(`No se pudo preparar el repaso: ${error.message}`);

  const newDoneToday = (today.data ?? []).filter((row) => row.state === 0).length;
  const spentTodayMs = (today.data ?? []).reduce((sum, row) => sum + (row.duration_ms ?? 0), 0);

  const cards = [...(due.data ?? []), ...(fresh.data ?? [])].flatMap(toReviewCard);
  const queue = buildQueue(
    cards.map((card) => ({
      id: card.id,
      state: card.state.state,
      due: card.state.due,
      created_at: card.created_at,
    })),
    { now, newDoneToday },
  );
  const byId = new Map(cards.map((card) => [card.id, card]));

  return {
    cards: queue.flatMap((item) => byId.get(item.id) ?? []),
    newDoneToday,
    spentTodayMs,
    totalCards: total.count ?? 0,
  };
}

/** Cuántas tarjetas tocan ahora (para «Hoy»). */
export async function getDueCount(): Promise<number> {
  return (await getReviewSession()).cards.length;
}

/** Claves de cosecha (`word:lemma`, `audio:s16`) que ya tienen tarjeta para una lección. */
export async function getExistingCardKeys(lessonId: string, lemmas: readonly string[]) {
  const { supabase } = await getSessionOrRedirect();
  const keys = new Set<string>();

  const { data: bySource, error } = await supabase
    .from('srs_cards')
    .select('kind, lemma, source_segment_id')
    .eq('source_lesson_id', lessonId);
  if (error) throw new Error(`No se pudieron leer las tarjetas: ${error.message}`);
  for (const card of bySource) {
    if (card.kind === 'audio' && card.source_segment_id) {
      keys.add(`audio:${card.source_segment_id.slice(lessonId.length + 1)}`);
    } else if (card.lemma) {
      keys.add(`${card.kind}:${card.lemma}`);
    }
  }

  // Una palabra tiene una sola tarjeta, venga de la lección que venga.
  if (lemmas.length > 0) {
    const { data: byLemma, error: lemmaError } = await supabase
      .from('srs_cards')
      .select('kind, lemma')
      .in('lemma', [...new Set(lemmas)]);
    if (lemmaError) throw new Error(`No se pudieron leer las tarjetas: ${lemmaError.message}`);
    for (const card of byLemma) if (card.lemma) keys.add(`${card.kind}:${card.lemma}`);
  }
  return keys;
}
