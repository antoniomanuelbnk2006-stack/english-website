'use server';

import { z } from 'zod';
import { MAX_THEME_CHARS, checkThemeCss } from '@/features/theme/lib/custom-css';
import { fail, ok, type ActionResult } from '@/lib/actions';
import { requireUser } from '@/lib/auth';
import type { Json } from '@/lib/supabase/database.types';
import type { SupabaseServerClient } from '@/lib/supabase/server';

// Margen para los espacios y saltos de línea que `checkThemeCss` quita antes de medir.
const SaveTheme = z.object({ css: z.string().max(MAX_THEME_CHARS + 1_000) });

/** Guarda (o quita, con `null`) el tema en `profiles.settings`, sin tocar el resto de ajustes. */
async function writeTheme(
  supabase: SupabaseServerClient,
  userId: string,
  css: string | null,
): Promise<ActionResult<null>> {
  const { data: current, error: readError } = await supabase
    .from('profiles')
    .select('settings')
    .eq('id', userId)
    .single();
  if (readError) return fail('internal');
  const previous =
    typeof current.settings === 'object' &&
    current.settings !== null &&
    !Array.isArray(current.settings)
      ? { ...current.settings }
      : {};
  if (css === null) delete previous.custom_css;
  else previous.custom_css = css;

  const { error } = await supabase
    .from('profiles')
    .update({ settings: previous as Json })
    .eq('id', userId);
  return error ? fail('internal') : ok(null);
}

/**
 * Guarda el tema personalizado (ADR-0033). Si el CSS no pasa la comprobación, el motivo va en
 * `message` (`too_long`, `markup`, `import` o `script`). Vacío es lo mismo que quitarlo.
 */
export async function saveCustomTheme(input: unknown): Promise<ActionResult<null>> {
  const parsed = SaveTheme.safeParse(input);
  if (!parsed.success) return fail('invalid_input', 'too_long');
  const session = await requireUser();
  if (!session.ok) return fail('unauthorized');

  const checked = checkThemeCss(parsed.data.css);
  if (!checked.ok) return fail('invalid_input', checked.reason);
  return writeTheme(session.supabase, session.user.id, checked.css === '' ? null : checked.css);
}

/** Quita el tema personalizado: vuelve el diseño de siempre. */
export async function clearCustomTheme(): Promise<ActionResult<null>> {
  const session = await requireUser();
  if (!session.ok) return fail('unauthorized');
  return writeTheme(session.supabase, session.user.id, null);
}
