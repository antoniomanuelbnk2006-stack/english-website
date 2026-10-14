import { NextResponse, type NextRequest } from 'next/server';
import { SAFE_MODE_HEADER, SAFE_MODE_PARAM } from '@/features/theme/lib/custom-css';
import { buildCsp } from '@/lib/csp';
import { env } from '@/lib/env';
import { isLocale } from '@/lib/i18n';
import { LOCALE_REQUEST_HEADER } from '@/lib/i18n/request';
import { canonicalUrl } from '@/lib/site-url';
import { LANDING_HOME, updateSession } from '@/lib/supabase/proxy';

export async function proxy(request: NextRequest) {
  // La web tiene una sola dirección (ADR-0021): lo que llega por otra se manda allí antes de
  // nada. Se mira la cabecera y no `nextUrl`, que fuera de Vercel no lleva el nombre pedido.
  const canonical = canonicalUrl(
    request.headers.get('x-forwarded-host') ?? request.headers.get('host'),
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
    env.SITE_URL,
  );
  if (canonical) return NextResponse.redirect(canonical, 307);

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = buildCsp({
    nonce,
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    audioBaseUrl: env.NEXT_PUBLIC_AUDIO_BASE_URL,
    isDev: process.env.NODE_ENV === 'development',
  });

  // Next lee el nonce de esta cabecera de la petición y lo aplica a sus propios scripts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);
  // El idioma elegido en la dirección (`?lang=fr`, ADR-0032). La cabecera solo la pone el proxy:
  // la que llegue de fuera se descarta.
  requestHeaders.delete(LOCALE_REQUEST_HEADER);
  const lang = request.nextUrl.searchParams.get('lang');
  if (isLocale(lang)) requestHeaders.set(LOCALE_REQUEST_HEADER, lang);
  // Modo seguro del tema personalizado (`?sin-tema`, ADR-0033): la página se pinta sin él.
  requestHeaders.delete(SAFE_MODE_HEADER);
  if (request.nextUrl.searchParams.has(SAFE_MODE_PARAM)) requestHeaders.set(SAFE_MODE_HEADER, '1');

  const response = await updateSession(request, requestHeaders);
  // La portada pública es HTML estático con su fuente y sus fotos de fuera: no lleva la CSP de
  // la app, sino la suya, que es fija y sale de next.config.ts.
  const isLanding = response.headers.get('x-middleware-rewrite')?.endsWith(LANDING_HOME);
  if (!isLanding) response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    // Todo salvo estáticos de Next, iconos, manifiesto, service worker, audio local y la página
    // de presentación (public/landing, sin datos). Las excepciones son carpetas y ficheros
    // concretos, nunca extensiones: «/leer/algo.png» es una pantalla privada como cualquier otra.
    '/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|serwist/|dev-audio/|landing/).*)',
  ],
};
