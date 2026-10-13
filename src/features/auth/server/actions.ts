'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { confirmUrl } from '@/features/auth/lib/confirm';
import { derivedPassword, Password } from '@/features/auth/lib/password';
import { fail, ok, type ActionResult } from '@/lib/actions';
import { env } from '@/lib/env';
import { createClient, type SupabaseServerClient } from '@/lib/supabase/server';

const Email = z.string().trim().toLowerCase().pipe(z.email().max(254));

const RequestOtpInput = z.object({ email: Email });
/** El código que llega por correo tiene 6 cifras. */
const VerifyOtpInput = z.object({ email: Email, token: z.string().regex(/^\d{6}$/) });
const PasswordInput = z.object({ email: Email, password: Password });

/** 429 de Supabase Auth: demasiadas peticiones de código o de verificación. */
function isRateLimited(error: { status?: number }): boolean {
  return error.status === 429;
}

/** Lo que responde `login_attempt_begin` (supabase/migrations/0005_login_attempts.sql). */
const LoginGate = z.object({ allowed: z.boolean(), retry_after_s: z.number().int().min(0) });

/** Si el acceso está cerrado por intentos fallidos, cuántos segundos faltan para reabrirse. */
export type SignInResult = ActionResult<never> & { retryAfterSeconds?: number };

/**
 * Anota un intento de acceso antes de probar nada (ADR-0024): tras varios seguidos sin acertar,
 * la base de datos deja de admitir más durante un rato. Devuelve el motivo para no seguir, o
 * `null` si se puede probar. Si el intento no se puede anotar, tampoco se prueba: un fallo aquí
 * no puede convertirse en intentos sin límite.
 */
async function refuseAttempt(
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

/** Ha entrado: la cuenta de intentos vuelve a cero (solo se puede con sesión) y se va a /hoy. */
async function enter(supabase: SupabaseServerClient): Promise<never> {
  await supabase.rpc('login_attempt_clear');
  redirect('/hoy');
}

/**
 * Pide el correo de acceso, que trae un código de 6 dígitos, un enlace o las dos cosas según
 * la plantilla de Supabase (ADR-0018). La respuesta es la misma tenga o no acceso el email,
 * para no revelar cuál es el permitido.
 */
export async function requestOtp(input: unknown): Promise<ActionResult<{ email: string }>> {
  const parsed = RequestOtpInput.safeParse(input);
  if (!parsed.success) return fail('invalid_input');
  const { email } = parsed.data;

  // Primera barrera: solo el email permitido llega a Supabase.
  if (email !== env.ALLOWED_EMAIL) return ok({ email });

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // Segunda barrera: nunca se crean usuarios desde la app (el registro está desactivado).
      shouldCreateUser: false,
      // El enlace del correo vuelve a esta misma web (src/app/auth/confirm/route.ts).
      emailRedirectTo: confirmUrl((await headers()).get('origin')),
    },
  });
  if (error) return fail(isRateLimited(error) ? 'rate_limited' : 'internal');

  return ok({ email });
}

/** Comprueba el código de 6 cifras del correo y, si es correcto, abre sesión y entra en /hoy. */
export async function verifyOtp(input: unknown): Promise<SignInResult> {
  const parsed = VerifyOtpInput.safeParse(input);
  if (!parsed.success) return fail('invalid_input');
  const { email, token } = parsed.data;

  if (email !== env.ALLOWED_EMAIL) return fail('unauthorized');

  const supabase = await createClient();
  const refused = await refuseAttempt(supabase, email);
  if (refused) return refused;

  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error) return fail(isRateLimited(error) ? 'rate_limited' : 'unauthorized');

  return enter(supabase);
}

/**
 * Entra con la contraseña (ADR-0026). Lo que se manda a Supabase no es lo que escribe el
 * usuario, sino la contraseña derivada de ello con el secreto del servidor: sin ese secreto no
 * se puede probar nada directamente contra Supabase.
 */
export async function signInWithPassword(input: unknown): Promise<SignInResult> {
  const parsed = PasswordInput.safeParse(input);
  if (!parsed.success) return fail('invalid_input');
  const { email, password } = parsed.data;

  // Sin secreto en el servidor no hay acceso con contraseña: solo el del correo.
  if (email !== env.ALLOWED_EMAIL || !env.LOGIN_CODE_PEPPER) return fail('unauthorized');

  const supabase = await createClient();
  const refused = await refuseAttempt(supabase, email);
  if (refused) return refused;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: derivedPassword(env.LOGIN_CODE_PEPPER, email, password),
  });
  if (error) return fail(isRateLimited(error) ? 'rate_limited' : 'unauthorized');

  return enter(supabase);
}

export async function signOut(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
