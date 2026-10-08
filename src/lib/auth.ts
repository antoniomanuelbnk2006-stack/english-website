import 'server-only';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { env } from '@/lib/env';
import { createClient, type SupabaseServerClient } from '@/lib/supabase/server';

export interface AuthUser {
  id: string;
  email: string;
}

type Session =
  | { ok: true; user: AuthUser; supabase: SupabaseServerClient }
  | { ok: false; error: 'unauthorized' };

/**
 * Sesión + email permitido. Segunda barrera tras src/proxy.ts: cada Server Action y cada
 * página la comprueba por su cuenta. Se resuelve una sola vez por petición.
 */
export const requireUser = cache(async (): Promise<Session> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const email = typeof claims?.email === 'string' ? claims.email.toLowerCase() : null;

  if (error || !claims?.sub || email === null || email !== env.ALLOWED_EMAIL) {
    return { ok: false, error: 'unauthorized' };
  }
  return { ok: true, user: { id: claims.sub, email }, supabase };
});

/** Para páginas y layouts: devuelve la sesión o redirige al acceso. */
export async function getSessionOrRedirect(): Promise<{
  user: AuthUser;
  supabase: SupabaseServerClient;
}> {
  const session = await requireUser();
  if (!session.ok) redirect('/login');
  return { user: session.user, supabase: session.supabase };
}
