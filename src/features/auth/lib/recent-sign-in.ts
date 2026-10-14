import { z } from 'zod';

// Poner la contraseña sin escribir la actual (ADR-0031). Vale si se acaba de entrar con el correo:
// eso ya demuestra que se tiene acceso al buzón, que es lo mismo que haría falta para recuperarla.

/** Lo que responde la acción cuando hace falta la contraseña actual (ya no vale la entrada por correo). */
export const CURRENT_PASSWORD_REQUIRED = 'current_required';

/** Durante cuánto tiempo, después de entrar con el correo, se puede poner sin la actual. */
export const RECENT_EMAIL_SIGN_IN_SECONDS = 10 * 60;

/** Las formas de entrar de Supabase que pasan por el correo (el código y el enlace). */
const EMAIL_METHODS = new Set(['otp', 'magiclink', 'recovery', 'email/signup', 'invite']);

/** `amr` del token de Supabase: cómo y cuándo se ha entrado en esta sesión. */
const Amr = z.array(z.object({ method: z.string(), timestamp: z.number() }));

/**
 * ¿Se ha entrado con el correo hace menos de `RECENT_EMAIL_SIGN_IN_SECONDS`? Lee el `amr` del
 * token; si no lo trae o no se entiende, no: entonces se pide la contraseña actual.
 */
export function signedInByEmailRecently(amr: unknown, nowSeconds: number): boolean {
  const parsed = Amr.safeParse(amr);
  if (!parsed.success) return false;
  return parsed.data.some(
    ({ method, timestamp }) =>
      EMAIL_METHODS.has(method) &&
      timestamp <= nowSeconds + 60 &&
      nowSeconds - timestamp <= RECENT_EMAIL_SIGN_IN_SECONDS,
  );
}
