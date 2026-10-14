import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { CONSENT_COOKIE, parseConsent, remembersSession } from '@/lib/consent';
import { env } from '@/lib/env';
import { SESSION_COOKIE_OPTIONS, sessionCookieOptions } from './cookies';
import type { Database } from './database.types';

/**
 * Cliente de Supabase para Server Components, Server Actions y Route Handlers.
 * Usa la clave publishable y la sesión del usuario (RLS); nunca la clave secret.
 * Hay que crear uno por petición.
 */
export async function createClient() {
  const cookieStore = await cookies();
  // La sesión solo se recuerda con las cookies aceptadas (ADR-0030).
  const remember = remembersSession(parseConsent(cookieStore.get(CONSENT_COOKIE)?.value));

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookieOptions: SESSION_COOKIE_OPTIONS,
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, sessionCookieOptions(options, remember)),
            );
          } catch {
            // En un Server Component no se pueden escribir cookies: las refresca src/proxy.ts.
          }
        },
      },
    },
  );
}

export type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
