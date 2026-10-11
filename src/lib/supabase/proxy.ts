import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { CONFIRM_PATH } from '@/features/auth/lib/confirm';
import { env } from '@/lib/env';
import type { Database } from './database.types';

const HOME = '/hoy';
const LOGIN = '/login';
/** Portada pública (ADR-0022): lo que ve en «/» quien no ha entrado. */
export const LANDING_HOME = '/landing/index.html';

/**
 * Refresca la sesión de Supabase y deja pasar solo al email permitido.
 * `requestHeaders` son las cabeceras que verá el renderizado (incluyen el nonce de la CSP).
 */
export async function updateSession(
  request: NextRequest,
  requestHeaders: Headers,
): Promise<NextResponse> {
  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet, headers) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          requestHeaders.set('cookie', request.cookies.toString());
          response = NextResponse.next({ request: { headers: requestHeaders } });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          // Una respuesta que escribe cookies de sesión no debe cachearse en ningún intermediario.
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  // No ejecutes nada entre createServerClient y esta llamada: es la que refresca la sesión.
  const { data } = await supabase.auth.getClaims();
  const claimEmail = data?.claims?.email;
  const email = typeof claimEmail === 'string' ? claimEmail.toLowerCase() : null;
  const allowed = email !== null && email === env.ALLOWED_EMAIL;

  const { pathname } = request.nextUrl;
  const isLogin = pathname === LOGIN;

  if (allowed && !isLogin) return response;
  if (!allowed && pathname === '/') {
    return withSessionCookies(response, NextResponse.rewrite(new URL(LANDING_HOME, request.url)));
  }
  // Sin sesión solo se ven la pantalla de acceso y la llegada desde el enlace del correo.
  if (!allowed && (isLogin || pathname === CONFIRM_PATH)) return response;

  if (!allowed && pathname.startsWith('/api/')) {
    return withSessionCookies(
      response,
      NextResponse.json({ error: 'unauthorized' }, { status: 401 }),
    );
  }

  const url = request.nextUrl.clone();
  url.pathname = allowed ? HOME : LOGIN;
  url.search = '';
  return withSessionCookies(response, NextResponse.redirect(url));
}

/** Conserva en la respuesta final las cookies que se hayan refrescado por el camino. */
function withSessionCookies(from: NextResponse, to: NextResponse): NextResponse {
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie));
  return to;
}
