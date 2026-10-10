import { createHmac } from 'node:crypto';
import { z } from 'zod';

// Acceso con un código fijo (docs/adr/0020-codigo-fijo-de-acceso.md). El código no se guarda en
// ningún sitio: es la contraseña del usuario en Supabase Auth, derivada de él con un secreto que
// solo conoce el servidor. Solo para el servidor (usa `node:crypto`).

/** Un código fijo: de 4 a 8 cifras. */
export const FixedCode = z.string().regex(/^\d{4,8}$/);

/** Longitud mínima del secreto con el que se deriva la contraseña. */
export const PEPPER_MIN_LENGTH = 32;

/**
 * La contraseña de Supabase que corresponde a un código fijo. Sin el secreto (`pepper`) no se
 * puede calcular, así que nadie puede probar códigos directamente contra Supabase: tiene que
 * pasar por el servidor de la app.
 */
export function codePassword(pepper: string, email: string, code: string): string {
  return createHmac('sha256', pepper)
    .update(`${email.trim().toLowerCase()}\n${code}`)
    .digest('base64url');
}
