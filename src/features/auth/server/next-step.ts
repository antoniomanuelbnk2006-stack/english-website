import 'server-only';
import { cookies } from 'next/headers';
import { PASSWORD_SECTION_ID } from '@/features/auth/lib/password-rules';

// «¿Has olvidado la contraseña?» (ADR-0031): se pide el correo de siempre y, al entrar con él, se
// va a Ajustes a poner una nueva en vez de a Hoy. Como el enlace del correo vuelve siempre a la
// misma dirección, lo que hay que hacer después se recuerda en una cookie necesaria y corta.

const NEXT_STEP_COOKIE = 'senal_next';
const NEXT_STEP_MAX_AGE = 60 * 60;

/** Dónde se pone la contraseña: el apartado de Ajustes. */
export const PASSWORD_SETTINGS = { pathname: '/ajustes', hash: PASSWORD_SECTION_ID } as const;

/** Al pedir el correo: si es para recuperar la contraseña, se anota; si no, se borra lo que hubiera. */
export async function rememberNextStep(forgotPassword: boolean): Promise<void> {
  const store = await cookies();
  if (!forgotPassword) {
    store.delete(NEXT_STEP_COOKIE);
    return;
  }
  store.set(NEXT_STEP_COOKIE, 'password', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: NEXT_STEP_MAX_AGE,
  });
}

/** Al entrar con el correo: ¿había que ir a poner la contraseña? Se lee una sola vez. */
export async function takeNextStep(): Promise<'password' | null> {
  const store = await cookies();
  const value = store.get(NEXT_STEP_COOKIE)?.value;
  if (value === undefined) return null;
  store.delete(NEXT_STEP_COOKIE);
  return value === 'password' ? 'password' : null;
}
