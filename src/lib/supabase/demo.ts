/**
 * Acceso automático de la demo (scripts/demo.ts): la demo de este ordenador entra sola, sin
 * pantalla de acceso, con el usuario y el código del emulador de Supabase (ADR-0011).
 *
 * Solo se activa si la demo lo pide (`DEMO_AUTO_LOGIN=1`) **y** Supabase es el emulador de esta
 * máquina. Con un Supabase de verdad (la web publicada) no hace nada aunque la variable estuviera
 * puesta: el código del emulador no vale allí y ni siquiera se intenta.
 */

/** El código que acepta el emulador (tests/support/supabase-emulator.ts). */
export const DEMO_OTP = '123456';

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

export function demoAutoLogin(supabaseUrl: string, flag: string | undefined): boolean {
  if (flag !== '1' || !URL.canParse(supabaseUrl)) return false;
  return LOCAL_HOSTS.has(new URL(supabaseUrl).hostname);
}
