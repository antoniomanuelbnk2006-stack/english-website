'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { confirmUrl } from '@/features/auth/lib/confirm';
import { codePassword } from '@/features/auth/lib/fixed-code';
import { fail, ok, type ActionResult } from '@/lib/actions';
import { env } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';

const Email = z.string().trim().toLowerCase().pipe(z.email().max(254));

const RequestOtpInput = z.object({ email: Email });
// El código del correo tiene 6 cifras; el fijo, de 4 a 8 (ADR-0020).
const VerifyOtpInput = z.object({ email: Email, token: z.string().regex(/^\d{4,8}$/) });

/** 429 de Supabase Auth: demasiadas peticiones de código o de verificación. */
function isRateLimited(error: { status?: number }): boolean {
  return error.status === 429;
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

/**
 * Comprueba el código y, si es correcto, abre sesión y entra en /hoy. Vale el código fijo (si
 * está configurado) o el de 6 cifras del correo.
 */
export async function verifyOtp(input: unknown): Promise<ActionResult<never>> {
  const parsed = VerifyOtpInput.safeParse(input);
  if (!parsed.success) return fail('invalid_input');
  const { email, token } = parsed.data;

  if (email !== env.ALLOWED_EMAIL) return fail('unauthorized');

  const supabase = await createClient();

  // Código fijo: es la contraseña del usuario en Supabase, derivada con un secreto del servidor.
  let signedIn = false;
  if (env.LOGIN_CODE_PEPPER) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: codePassword(env.LOGIN_CODE_PEPPER, email, token),
    });
    if (error && isRateLimited(error)) return fail('rate_limited');
    signedIn = !error;
  }

  if (!signedIn) {
    if (token.length !== 6) return fail('unauthorized');
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    if (error) return fail(isRateLimited(error) ? 'rate_limited' : 'unauthorized');
  }

  redirect('/hoy');
}

export async function signOut(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
