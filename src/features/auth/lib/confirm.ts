import { z } from 'zod';

// Acceso con el enlace del correo (docs/adr/0018-acceso-con-enlace-del-correo.md). Lógica pura.

/** Ruta a la que vuelve el enlace del correo de acceso. */
export const CONFIRM_PATH = '/auth/confirm';

/** Motivo que se pasa a la pantalla de acceso cuando el enlace no sirve. */
export const LINK_ERROR = 'enlace';

/** El código de un solo uso que Supabase añade a la URL al volver del enlace. */
export const AuthCode = z
  .string()
  .min(8)
  .max(256)
  .regex(/^[A-Za-z0-9_-]+$/);

/**
 * Adónde debe volver el enlace del correo: esta misma web. `undefined` si el origen de la
 * petición no es una URL http(s); entonces Supabase usa la URL del sitio que tiene configurada.
 */
export function confirmUrl(origin: string | null | undefined): string | undefined {
  if (!origin || !URL.canParse(origin)) return undefined;
  const url = new URL(origin);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
  return new URL(CONFIRM_PATH, url.origin).toString();
}
