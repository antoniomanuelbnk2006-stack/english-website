'use server';

import { z } from 'zod';
import { CEFR_LEVELS } from '@/features/level/lib/bands';
import { fail, ok, type ActionResult } from '@/lib/actions';
import { requireUser } from '@/lib/auth';

const LevelInput = z.object({ level: z.enum(CEFR_LEVELS) });

/**
 * Guarda el nivel que el usuario dice tener. Decide qué contenido se le enseña primero y qué
 * palabras se dan por conocidas mientras no haya un test de nivel.
 */
export async function setDeclaredLevel(input: unknown): Promise<ActionResult<null>> {
  const parsed = LevelInput.safeParse(input);
  if (!parsed.success) return fail('invalid_input');

  const session = await requireUser();
  if (!session.ok) return fail('unauthorized');

  const { error } = await session.supabase
    .from('profiles')
    .update({ declared_level: parsed.data.level })
    .eq('id', session.user.id);
  if (error) return fail('internal');
  return ok(null);
}
