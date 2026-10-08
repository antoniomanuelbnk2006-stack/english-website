import type { NextRequest } from 'next/server';
import { buildCsp } from '@/lib/csp';
import { env } from '@/lib/env';
import { updateSession } from '@/lib/supabase/proxy';

export async function proxy(request: NextRequest) {
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
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    // Todo salvo estáticos de Next, iconos, manifiesto, service worker, audio local e imágenes.
    '/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|serwist/|dev-audio/|.*\\.(?:png|svg|jpg|webp|ico)$).*)',
  ],
};
