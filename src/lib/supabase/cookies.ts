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
