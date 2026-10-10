import 'server-only';
import { z } from 'zod';
import { getSessionOrRedirect } from '@/lib/auth';

const Response = z.object({
  type: z.literal('exam'),
  value: z.union([z.string(), z.number()]),
  sitting: z.string(),
});

export interface Sitting {
  /** Respuestas por lo que va tras el id de la prueba: número de pregunta o criterio. */
  answers: Record<string, string | number>;
  at: string;
}

/**
 * Las respuestas de la última vez que se entregó una prueba, tal como quedaron guardadas.
 * `null` si nunca se ha entregado.
 */
export async function getLastSitting(paperId: string): Promise<Sitting | null> {
  const { supabase } = await getSessionOrRedirect();
  const { data, error } = await supabase
    .from('item_attempts')
    .select('item_id, response, created_at')
    .eq('lesson_id', paperId)
    .order('created_at', { ascending: false })
    .limit(120);
  if (error) throw new Error(`No se pudo leer el simulacro: ${error.message}`);

  let sitting: string | null = null;
  let at = '';
  const answers: Record<string, string | number> = {};
  for (const row of data) {
    const response = Response.safeParse(row.response);
    if (!response.success) continue;
    sitting ??= response.data.sitting;
    if (response.data.sitting !== sitting) break;
    at ||= row.created_at;
    answers[row.item_id.slice(paperId.length + 1)] = response.data.value;
  }
  return sitting === null ? null : { answers, at };
}
