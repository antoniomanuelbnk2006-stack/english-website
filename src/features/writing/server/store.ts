import 'server-only';
import { z } from 'zod';
import type { FeedbackStore } from '@/features/writing/server/feedback';
import type { Json } from '@/lib/supabase/database.types';
import type { SupabaseServerClient } from '@/lib/supabase/server';

const toJson = (value: unknown): Json => JSON.parse(JSON.stringify(value)) as Json;

/** Lo que se guarda en `feedback` cuando un envío a la IA termina mal. */
const Failure = z.object({ error: z.enum(['refusal', 'max_tokens', 'api']) });

/**
 * `writing_submissions` como almacén de la corrección con IA. Todo va como el usuario de la
 * sesión, con RLS: aquí no hay clave secret.
 */
export function supabaseStore(supabase: SupabaseServerClient): FeedbackStore {
  return {
    async attemptsSince(since) {
      const { data, error } = await supabase
        .from('writing_submissions')
        .select('created_at, status, cost_usd, feedback')
        .eq('review_kind', 'ai')
        .gte('created_at', since.toISOString());
      if (error) return null;
      return data.map((row) => ({
        createdAt: row.created_at,
        status: row.status,
        costUsd: Number(row.cost_usd),
        reason: Failure.safeParse(row.feedback).data?.error ?? null,
      }));
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
