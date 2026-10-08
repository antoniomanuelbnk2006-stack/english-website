/** Origen de una URL absoluta, o `null` si es una ruta local (misma procedencia). */
function originOf(urlOrPath: string): string | null {
  return URL.canParse(urlOrPath) ? new URL(urlOrPath).origin : null;
}

export interface CspInput {
  nonce: string;
  supabaseUrl: string;
  audioBaseUrl: string;
  isDev: boolean;
}

/**
 * Content-Security-Policy de la app (docs/04-arquitectura/07-seguridad-y-privacidad.md §5).
 * El nonce cambia en cada petición, así que todas las páginas se renderizan de forma dinámica.
 */
export function buildCsp({ nonce, supabaseUrl, audioBaseUrl, isDev }: CspInput): string {
  const supabase = originOf(supabaseUrl);
  const audio = originOf(audioBaseUrl);
  const list = (...sources: (string | null | false)[]) => sources.filter(Boolean).join(' ');

  const directives = [
    `default-src 'self'`,
    // En desarrollo React usa eval para reconstruir las trazas de error del servidor.
    `script-src ${list(`'self'`, `'nonce-${nonce}'`, `'strict-dynamic'`, isDev && `'unsafe-eval'`)}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `media-src ${list(`'self'`, 'blob:', audio)}`,
    `connect-src ${list(`'self'`, supabase, audio, isDev && 'ws:')}`,
    `font-src 'self'`,
    `worker-src 'self'`,
    `object-src 'none'`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
  ];
  return directives.join('; ');
}
