import { createHmac, randomInt } from 'node:crypto';
import { z } from 'zod';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from './password-rules';

// Acceso con contraseña (docs/adr/0026-contrasena-en-vez-de-codigo-fijo.md). La contraseña no
// se guarda en ningún sitio de la app: con un secreto que solo conoce el servidor se convierte
// en otra, larga y al azar, y esa es la contraseña del usuario en Supabase Auth. Solo para el
// servidor (usa `node:crypto`).

/** La contraseña tal como se escribe: no se recortan espacios ni se cambia nada. */
export const Password = z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH);

/** Longitud mínima del secreto con el que se deriva la contraseña. */
export const PEPPER_MIN_LENGTH = 32;

/**
 * La contraseña de Supabase que corresponde a la que escribe el usuario. Sin el secreto
 * (`pepper`) no se puede calcular, así que nadie puede probar contraseñas directamente contra
 * Supabase: tiene que pasar por el servidor de la app, que cuenta los intentos (ADR-0024).
 */
export function derivedPassword(pepper: string, email: string, password: string): string {
  return createHmac('sha256', pepper)
    .update(`${email.trim().toLowerCase()}\n${password}`)
    .digest('base64url');
}

/** Letras y cifras que no se confunden al leerlas o dictarlas (sin 0/o ni 1/l/i). */
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

/** Una contraseña al azar y cómoda de copiar: cinco grupos de cuatro (unos 99 bits). */
export function generatePassword(): string {
  const group = () =>
    Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  return Array.from({ length: 5 }, group).join('-');
}
