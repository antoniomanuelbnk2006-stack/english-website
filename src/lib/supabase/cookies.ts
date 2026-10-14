import type { CookieOptions } from '@supabase/ssr';

/**
 * Cómo se escriben las cookies de la sesión. `@supabase/ssr` las deja legibles desde JavaScript
 * por defecto, porque su cliente de navegador las necesita; esta app solo habla con Supabase
 * desde el servidor, así que se cierran:
 *
 * - `httpOnly`: un script inyectado en la página no puede llevarse la sesión.
 * - `secure`: solo viajan por HTTPS. Los navegadores hacen una excepción con `localhost`, que
 *   es como corren el desarrollo, la demo y los tests.
 */
export const SESSION_COOKIE_OPTIONS: CookieOptions = { httpOnly: true, secure: true };

/** Lo que dura una sesión recordada: lo que pone `@supabase/ssr` (400 días, el máximo de Chrome). */
export const REMEMBERED_SESSION_MAX_AGE = 400 * 24 * 60 * 60;

/** Las cookies de la sesión: `sb-<proyecto>-auth-token` y sus trozos (`.0`, `.1`…). */
export function isSessionCookie(name: string): boolean {
  return /^sb-.+-auth-token(\.\d+)?$/.test(name);
}

/**
 * Cuánto dura la cookie que se va a escribir (ADR-0030). `@supabase/ssr` pone siempre 400 días;
 * eso es recordar la sesión, y solo se hace con las cookies aceptadas. Si no, la cookie queda sin
 * caducidad: el navegador la borra al cerrarse y al volver hay que entrar otra vez. Las que se
 * están borrando (`maxAge: 0`) no se tocan.
 */
export function sessionCookieOptions(options: CookieOptions, remember: boolean): CookieOptions {
  if (remember || options.maxAge === 0) return options;
  const browserSession = { ...options };
  delete browserSession.maxAge;
  delete browserSession.expires;
  return browserSession;
}
