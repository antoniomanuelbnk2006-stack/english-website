'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { confirmUrl } from '@/features/auth/lib/confirm';
import { fail, ok, type ActionResult } from '@/lib/actions';
import { env } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';

const Email = z.string().trim().toLowerCase().pipe(z.email().max(254));

const RequestOtpInput = z.object({ email: Email });
const VerifyOtpInput = z.object({ email: Email, token: z.string().regex(/^\d{6}$/) });

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

/** Comprueba el código y, si es correcto, abre sesión y entra en /hoy. */
export async function verifyOtp(input: unknown): Promise<ActionResult<never>> {
  const parsed = VerifyOtpInput.safeParse(input);
  if (!parsed.success) return fail('invalid_input');
  const { email, token } = parsed.data;

  if (email !== env.ALLOWED_EMAIL) return fail('unauthorized');

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error) return fail(isRateLimited(error) ? 'rate_limited' : 'unauthorized');

  redirect('/hoy');
}

export async function signOut(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
