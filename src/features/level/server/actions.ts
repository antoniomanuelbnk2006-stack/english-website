'use server';

import { z } from 'zod';
import { CEFR_LEVELS } from '@/features/level/lib/bands';
import { fail, ok, type ActionResult } from '@/lib/actions';
import { getPracticeLanguage } from '@/features/profile/server/queries';
import { requireUser } from '@/lib/auth';
import { LANGUAGES_WITH_CONTENT } from '@/lib/content/index';
import { PRACTICE_LANGUAGES } from '@/lib/content/language';
import type { Json } from '@/lib/supabase/database.types';

const LevelInput = z.object({
  level: z.enum(CEFR_LEVELS),
  /** El idioma que practica, si había que elegirlo (ADR-0036). */
  language: z.enum(PRACTICE_LANGUAGES).optional(),
});

/**
 * Guarda el nivel que el usuario dice tener y, si lo ha elegido, el idioma que practica. El nivel
 * decide qué contenido se le enseña primero y qué palabras se dan por conocidas mientras no haya
 * un test de nivel.
 */
export async function setDeclaredLevel(input: unknown): Promise<ActionResult<null>> {
  const parsed = LevelInput.safeParse(input);
  const { language } = parsed.data ?? {};
  // Solo se puede practicar un idioma que tenga contenido.
  if (!parsed.success || (language && !LANGUAGES_WITH_CONTENT.includes(language))) {
    return fail('invalid_input');
  }

  const session = await requireUser();
  if (!session.ok) return fail('unauthorized');
  const { supabase, user } = session;

  // El nivel es del idioma que se practica; si el usuario acaba de elegir idioma, de ese.
  const target = language ?? (await getPracticeLanguage());
  const { error: levelError } = await supabase
    .from('language_levels')
    .upsert(
      { language: target, declared_level: parsed.data.level },
      { onConflict: 'user_id,language' },
    );
  if (levelError) return fail('internal');

  if (language) {
    // Se conserva el resto de `settings`.
    const { data: current, error: readError } = await supabase
      .from('profiles')
      .select('settings')
      .eq('id', user.id)
      .single();
    if (readError) return fail('internal');
    const previous =
      typeof current.settings === 'object' &&
      current.settings !== null &&
      !Array.isArray(current.settings)
        ? current.settings
        : {};
    const settings: Json = { ...previous, practice_language: language };
    const { error } = await supabase.from('profiles').update({ settings }).eq('id', user.id);
    if (error) return fail('internal');
  }
  return ok(null);
}
