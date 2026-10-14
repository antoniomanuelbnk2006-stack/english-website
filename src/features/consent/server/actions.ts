'use server';

import { cookies } from 'next/headers';
import { fail, ok, type ActionResult } from '@/lib/actions';
import { requireUser } from '@/lib/auth';
import { CONSENT_COOKIE, parseConsent, remembersSession } from '@/lib/consent';
import {
  REMEMBERED_SESSION_MAX_AGE,
  SESSION_COOKIE_OPTIONS,
  isSessionCookie,
  sessionCookieOptions,
} from '@/lib/supabase/cookies';

/**
 * Aplica a la sesión abierta la decisión sobre las cookies que se acaba de tomar (ADR-0030):
 * vuelve a escribir sus cookies, recordadas si se han aceptado y, si no, solo hasta que se cierre
 * el navegador. Sin esto, el cambio llegaría en la próxima renovación de la sesión (una hora).
 */
export async function applyConsentToSession(): Promise<ActionResult<null>> {
  const session = await requireUser();
  if (!session.ok) return fail('unauthorized');

  const cookieStore = await cookies();
  const remember = remembersSession(parseConsent(cookieStore.get(CONSENT_COOKIE)?.value));
  const options = sessionCookieOptions(
    { path: '/', sameSite: 'lax', ...SESSION_COOKIE_OPTIONS, maxAge: REMEMBERED_SESSION_MAX_AGE },
    remember,
  );
  for (const { name, value } of cookieStore.getAll()) {
    if (isSessionCookie(name)) cookieStore.set(name, value, options);
  }
  return ok(null);
}
