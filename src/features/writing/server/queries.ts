import 'server-only';
import { cache } from 'react';
import type { HistoryEntry } from '@/features/writing/lib/history';
import { checkLimits, usageFrom } from '@/features/writing/lib/limits';
import {
  parseStoredFeedback,
  type Level,
  type Scores,
  type StoredFeedback,
} from '@/features/writing/lib/schema';
import { attemptsSince } from '@/features/writing/server/store';
import { getSessionOrRedirect } from '@/lib/auth';
import { startOfMonthMadrid, startOfTodayMadrid } from '@/lib/dates';
import { env } from '@/lib/env';

/** Lo que la interfaz necesita saber de la corrección con IA. Nunca incluye la clave. */
export interface AiStatus {
  /** Hay clave de la API configurada en el servidor. */
  enabled: boolean;
  usedToday: number;
  dailyLimit: number;
  /** `false` si se ha llegado al tope de gasto del mes. */
  budgetLeft: boolean;
}

export const getAiStatus = cache(async (): Promise<AiStatus> => {
  const dailyLimit = env.AI_DAILY_LIMIT;
  if (!env.ANTHROPIC_API_KEY) return { enabled: false, usedToday: 0, dailyLimit, budgetLeft: true };

  const { supabase } = await getSessionOrRedirect();
  const now = new Date();
  const attempts = await attemptsSince(supabase, startOfMonthMadrid(now));
  if (!attempts) throw new Error('No se pudo leer el uso de la corrección con IA');
  const usage = usageFrom(attempts, startOfTodayMadrid(now));
  const state = checkLimits({
    ...usage,
    dailyLimit,
    monthlyBudgetUsd: env.AI_MONTHLY_BUDGET_USD,
  });
  return {
    enabled: true,
    usedToday: usage.usedToday,
    dailyLimit,
    budgetLeft: state !== 'monthly_budget',
  };
});

export interface SubmissionSummary extends HistoryEntry {
  promptId: string | null;
  taskType: string;
  level: Level;
  wordCount: number;
  /** Nivel que la IA estima para el texto; `null` en las revisiones sin IA. */
  estimatedLevel: Level | null;
  rewritten: boolean;
  examMode: boolean;
  activeSeconds: number;
}

const SUMMARY_COLUMNS =
  'id, created_at, prompt_id, task_type, target_level, word_count, review_kind, feedback, rewrite_text, exam_mode, active_seconds';

const scoresOf = (feedback: StoredFeedback | null): Scores | null =>
  feedback === null ? null : feedback.kind === 'ai' ? feedback.feedback.scores : feedback.scores;

/** Los writings entregados (los envíos a la IA que fallaron no cuentan), del más reciente al más antiguo. */
export const getSubmissions = cache(async (): Promise<SubmissionSummary[]> => {
  const { supabase } = await getSessionOrRedirect();
  const { data, error } = await supabase
    .from('writing_submissions')
    .select(SUMMARY_COLUMNS)
    .eq('status', 'done')
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) throw new Error(`No se pudieron leer los writings: ${error.message}`);

  return data.map((row) => {
    const feedback = parseStoredFeedback(row.feedback);
    return {
      id: row.id,
      createdAt: row.created_at,
      kind: row.review_kind === 'self' ? 'self' : 'ai',
      scores: scoresOf(feedback),
      promptId: row.prompt_id,
      taskType: row.task_type,
      level: row.target_level,
      wordCount: row.word_count,
      estimatedLevel: feedback?.kind === 'ai' ? feedback.feedback.estimated_level : null,
      rewritten: row.rewrite_text !== null,
      examMode: row.exam_mode,
      activeSeconds: row.active_seconds,
    };
  });
});

export interface SubmissionDetail extends SubmissionSummary {
  text: string;
  rewriteText: string | null;
  feedback: StoredFeedback | null;
}

/** Una entrega con su texto y su feedback. `null` si no existe (o no es del usuario: RLS). */
export async function getSubmission(id: string): Promise<SubmissionDetail | null> {
  const { supabase } = await getSessionOrRedirect();
  const { data, error } = await supabase
    .from('writing_submissions')
    .select(`${SUMMARY_COLUMNS}, text`)
    .eq('id', id)
    .eq('status', 'done')
    .maybeSingle();
  if (error) throw new Error(`No se pudo leer el writing: ${error.message}`);
  if (!data) return null;

  const feedback = parseStoredFeedback(data.feedback);
  return {
    id: data.id,
    createdAt: data.created_at,
    kind: data.review_kind === 'self' ? 'self' : 'ai',
    scores: scoresOf(feedback),
    promptId: data.prompt_id,
    taskType: data.task_type,
    level: data.target_level,
    wordCount: data.word_count,
    estimatedLevel: feedback?.kind === 'ai' ? feedback.feedback.estimated_level : null,
    rewritten: data.rewrite_text !== null,
    examMode: data.exam_mode,
    activeSeconds: data.active_seconds,
    text: data.text,
    rewriteText: data.rewrite_text,
    feedback,
  };
}

/** Cuántas veces se ha entregado cada consigna y cuándo fue la última. */
export async function getSubmissionsByPrompt(): Promise<
  Map<string, { count: number; lastAt: string }>
> {
  const byPrompt = new Map<string, { count: number; lastAt: string }>();
  for (const submission of await getSubmissions()) {
    if (!submission.promptId) continue;
    const current = byPrompt.get(submission.promptId);
    // Vienen del más reciente al más antiguo: la primera que aparece es la última entrega.
    byPrompt.set(submission.promptId, {
      count: (current?.count ?? 0) + 1,
      lastAt: current?.lastAt ?? submission.createdAt,
    });
  }
  return byPrompt;
}
