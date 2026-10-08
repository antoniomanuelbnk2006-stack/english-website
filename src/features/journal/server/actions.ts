'use server';

import { z } from 'zod';
import { LogInput } from '@/features/journal/lib/journal';
import { fail, ok, type ActionResult } from '@/lib/actions';
import { requireUser } from '@/lib/auth';
import { todayMadrid } from '@/lib/dates';

/** Registra en el diario contenido externo (el de la app se anota solo al hacer lecciones). */
export async function logInput(input: unknown): Promise<ActionResult<{ id: number }>> {
  const parsed = LogInput.safeParse(input);
  if (!parsed.success) return fail('invalid_input');

  const session = await requireUser();
  if (!session.ok) return fail('unauthorized');

  const { kind, minutes, title, url, perceivedLevel, words } = parsed.data;
  const { data, error } = await session.supabase
    .from('input_log')
    .insert({
      kind,
      source: 'external',
      minutes,
      title: title ?? null,
      url: url ?? null,
      perceived_level: perceivedLevel ?? null,
      words: words ?? null,
      logged_on: todayMadrid(),
    })
    .select('id')
    .single();
  if (error) return fail('internal');

  return ok({ id: data.id });
}

const DeleteInput = z.object({ id: z.number().int().positive() });

/** Borra un registro del diario (RLS garantiza que solo puede ser propio). */
export async function deleteInput(input: unknown): Promise<ActionResult<null>> {
  const parsed = DeleteInput.safeParse(input);
  if (!parsed.success) return fail('invalid_input');

  const session = await requireUser();
  if (!session.ok) return fail('unauthorized');

  const { error } = await session.supabase.from('input_log').delete().eq('id', parsed.data.id);
  if (error) return fail('internal');
  return ok(null);
}
