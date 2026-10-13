import 'server-only';
import { z } from 'zod';
import type { Attempt } from '@/features/writing/lib/limits';
import type { FeedbackStore } from '@/features/writing/server/feedback';
import type { Json } from '@/lib/supabase/database.types';
import type { SupabaseServerClient } from '@/lib/supabase/server';

const toJson = (value: unknown): Json => JSON.parse(JSON.stringify(value)) as Json;

const Reason = z.enum(['refusal', 'max_tokens', 'api']);

/** Lo que responde `ai_usage_reserve` (supabase/migrations/0006_ai_usage.sql). */
const Reserved = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), id: z.uuid(), token: z.uuid() }),
  z.object({ status: z.enum(['daily_limit', 'monthly_budget']) }),
]);

/**
 * Las llamadas a la IA desde `since`, leídas del registro `ai_usage` (ADR-0024): el usuario
 * puede verlo, pero no cambiarlo. `null` si falla la base de datos.
 */
export async function attemptsSince(
  supabase: SupabaseServerClient,
  since: Date,
): Promise<Attempt[] | null> {
  const { data, error } = await supabase
    .from('ai_usage')
    .select('created_at, status, reason, reserved_usd, cost_usd')
    .gte('created_at', since.toISOString());
  if (error) return null;
  return data.map((row) => ({
    createdAt: row.created_at,
    status: row.status,
    // Una reserva sin cerrar cuenta por su importe máximo, igual que en `ai_usage_reserve`.
    costUsd: Number(row.status === 'pending' ? row.reserved_usd : row.cost_usd),
    reason: Reason.safeParse(row.reason).data ?? null,
  }));
}

/**
 * El almacén de la corrección con IA: el gasto va al registro `ai_usage`, que solo se escribe
 * con sus dos funciones, y la entrega con su corrección a `writing_submissions`. Todo va como
 * el usuario de la sesión: aquí no hay clave secret.
 */
export function supabaseStore(supabase: SupabaseServerClient): FeedbackStore {
  return {
    async reserve(request) {
      const { data, error } = await supabase.rpc('ai_usage_reserve', {
        p_model: request.model,
        p_reserve_usd: request.reserveUsd,
        p_daily_limit: request.limits.daily,
        p_monthly_budget_usd: request.limits.monthlyUsd,
        p_day_start: request.dayStart.toISOString(),
        p_month_start: request.monthStart.toISOString(),
      });
      const reserved = Reserved.safeParse(data);
      if (error || !reserved.success) return { ok: false, error: 'db' };
      if (reserved.data.status !== 'ok') return { ok: false, error: reserved.data.status };
      return { ok: true, reservation: { id: reserved.data.id, token: reserved.data.token } };
    },

    async settle(reservation, data) {
      const { data: closed, error } = await supabase.rpc('ai_usage_settle', {
        p_id: reservation.id,
        p_token: reservation.token,
        p_outcome: data.outcome,
        p_cost_usd: data.costUsd,
        p_input_tokens: data.usage?.input_tokens ?? 0,
        p_output_tokens: data.usage?.output_tokens ?? 0,
      });
      return !error && closed === true;
    },

    async create(submission) {
      const { data, error } = await supabase
        .from('writing_submissions')
        .insert({
          prompt_id: submission.promptId,
          task_type: submission.taskType,
          target_level: submission.targetLevel,
          text: submission.text,
          word_count: submission.wordCount,
          status: 'pending',
          review_kind: 'ai',
          model: submission.model,
          exam_mode: submission.examMode,
          active_seconds: submission.activeSeconds,
        })
        .select('id')
        .single();
      return error || !data ? null : data.id;
    },

    async finish(id, data) {
      const { error } = await supabase
        .from('writing_submissions')
        .update({
          feedback: toJson(data.feedback),
          status: 'done',
          input_tokens: data.usage.input_tokens,
          output_tokens: data.usage.output_tokens,
          cost_usd: data.costUsd,
        })
        .eq('id', id);
      return !error;
    },

    async fail(id, data) {
      await supabase
        .from('writing_submissions')
        .update({
          feedback: toJson({ error: data.reason }),
          status: 'error',
          input_tokens: data.usage?.input_tokens ?? null,
          output_tokens: data.usage?.output_tokens ?? null,
          cost_usd: data.costUsd,
        })
        .eq('id', id);
    },
  };
}
