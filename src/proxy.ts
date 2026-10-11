import { NextResponse, type NextRequest } from 'next/server';
import { buildCsp } from '@/lib/csp';
import { env } from '@/lib/env';
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

  const response = await updateSession(request, requestHeaders);
  // La portada pública es HTML estático con su fuente y sus fotos de fuera: sin la CSP de la app.
  const isLanding = response.headers.get('x-middleware-rewrite')?.endsWith(LANDING_HOME);
  if (!isLanding) response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    // Todo salvo estáticos de Next, iconos, manifiesto, service worker, audio local, la página de
    // presentación (public/landing, sin datos) e imágenes.
    '/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|serwist/|dev-audio/|landing/|.*\\.(?:png|svg|jpg|webp|ico)$).*)',
  ],
};
