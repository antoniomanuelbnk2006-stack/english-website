import 'server-only';
import { z } from 'zod';
import { fail, type ActionResult } from '@/lib/actions';
import type { SupabaseServerClient } from '@/lib/supabase/server';

// Lo que comparten las acciones que prueban una contraseña o un código: entrar (actions.ts) y
// cambiar la contraseña con la actual (password-actions.ts). No es un fichero 'use server': lo
// que exporta no son acciones que se puedan llamar desde el navegador.

/** Si el acceso está cerrado por intentos fallidos, cuántos segundos faltan para reabrirse. */
export type SignInResult = ActionResult<never> & { retryAfterSeconds?: number };

/** 429 de Supabase Auth: demasiadas peticiones de código o de verificación. */
export function isRateLimited(error: { status?: number }): boolean {
  return error.status === 429;
}

/** Lo que responde `login_attempt_begin` (supabase/migrations/0005_login_attempts.sql). */
const LoginGate = z.object({ allowed: z.boolean(), retry_after_s: z.number().int().min(0) });

/**
 * Anota un intento de acceso antes de probar nada (ADR-0024): tras varios seguidos sin acertar,
 * la base de datos deja de admitir más durante un rato. Devuelve el motivo para no seguir, o
 * `null` si se puede probar. Si el intento no se puede anotar, tampoco se prueba: un fallo aquí
 * no puede convertirse en intentos sin límite.
 */
export async function refuseAttempt(
  supabase: SupabaseServerClient,
  email: string,
): Promise<SignInResult | null> {
  const begun = await supabase.rpc('login_attempt_begin', { p_email: email });
  const gate = LoginGate.safeParse(begun.data);
  if (begun.error || !gate.success) return fail('internal');
  if (!gate.data.allowed) {
    return { ...fail('rate_limited'), retryAfterSeconds: gate.data.retry_after_s };
  }
  return null;
}
