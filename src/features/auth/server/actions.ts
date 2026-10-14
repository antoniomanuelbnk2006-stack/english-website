'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { confirmUrl } from '@/features/auth/lib/confirm';
import { derivedPassword, Password } from '@/features/auth/lib/password';
import { isRateLimited, refuseAttempt, type SignInResult } from '@/features/auth/server/attempts';
import {
  PASSWORD_SETTINGS,
  rememberNextStep,
  takeNextStep,
} from '@/features/auth/server/next-step';
import { fail, ok, type ActionResult } from '@/lib/actions';
import { env } from '@/lib/env';
import { createClient, type SupabaseServerClient } from '@/lib/supabase/server';

const Email = z.string().trim().toLowerCase().pipe(z.email().max(254));

/** Para entrar hay que aceptar la política de privacidad, cada vez (ADR-0030). */
const PrivacyAccepted = z.literal(true);

const RequestOtpInput = z.object({
  email: Email,
  privacy: PrivacyAccepted,
  /** Se pide el correo porque se ha olvidado la contraseña: al entrar, a Ajustes (ADR-0031). */
  forgotPassword: z.boolean().optional(),
});
/** El código que llega por correo tiene 6 cifras. */
const VerifyOtpInput = z.object({
  email: Email,
  token: z.string().regex(/^\d{6}$/),
  privacy: PrivacyAccepted,
});
const PasswordInput = z.object({ email: Email, password: Password, privacy: PrivacyAccepted });

/**
 * Ha entrado: la cuenta de intentos vuelve a cero (solo se puede con sesión) y se va a /hoy. Si
 * ha entrado con el correo que pidió por haber olvidado la contraseña, a ponerla (ADR-0031).
 */
async function enter(supabase: SupabaseServerClient, viaEmail: boolean): Promise<never> {
  await supabase.rpc('login_attempt_clear');
  const next = viaEmail ? await takeNextStep() : null;
  redirect(
    next === 'password' ? `${PASSWORD_SETTINGS.pathname}#${PASSWORD_SETTINGS.hash}` : '/hoy',
  );
}

/**
 * Pide el correo de acceso, que trae un código de 6 dígitos, un enlace o las dos cosas según
 * la plantilla de Supabase (ADR-0018). La respuesta es la misma tenga o no acceso el email,
 * para no revelar cuál es el permitido.
 */
export async function requestOtp(input: unknown): Promise<ActionResult<{ email: string }>> {
  const parsed = RequestOtpInput.safeParse(input);
  if (!parsed.success) return fail('invalid_input');
  const { email, forgotPassword = false } = parsed.data;

  // Antes de mirar el email: así la respuesta es la misma tenga acceso o no.
  await rememberNextStep(forgotPassword);

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

  return enter(supabase, true);
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

  return enter(supabase, false);
}

export async function signOut(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
