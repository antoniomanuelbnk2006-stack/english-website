'use server';

import { z } from 'zod';
import { derivedPassword, Password } from '@/features/auth/lib/password';
import { PASSWORD_MAX_LENGTH } from '@/features/auth/lib/password-rules';
import {
  CURRENT_PASSWORD_REQUIRED,
  signedInByEmailRecently,
} from '@/features/auth/lib/recent-sign-in';
import { isRateLimited, refuseAttempt } from '@/features/auth/server/attempts';
import { fail, ok, type ActionResult } from '@/lib/actions';
import { requireUser } from '@/lib/auth';
import { env } from '@/lib/env';

const ChangePasswordInput = z
  .object({
    current: z.string().min(1).max(PASSWORD_MAX_LENGTH).optional(),
    password: Password,
    confirm: z.string(),
  })
  .refine((input) => input.password === input.confirm);

/** Si el acceso está cerrado por intentos fallidos, cuántos segundos faltan para reabrirse. */
export type ChangePasswordResult = ActionResult<null> & { retryAfterSeconds?: number };

/**
 * Pone o cambia la contraseña desde Ajustes (ADR-0031). Sin la actual solo se puede justo después
 * de entrar con el correo, que es lo que demuestra que el buzón es de quien la cambia; así quien
 * se haga con una sesión abierta no puede cambiarla y dejar fuera al dueño. Con la actual, se
 * comprueba como un intento de acceso más: cuenta para el bloqueo (ADR-0024).
 */
export async function changePassword(input: unknown): Promise<ChangePasswordResult> {
  const parsed = ChangePasswordInput.safeParse(input);
  if (!parsed.success) return fail('invalid_input');
  const session = await requireUser();
  if (!session.ok) return fail('unauthorized');

  // Sin el secreto del servidor no hay acceso con contraseña (ADR-0026).
  const pepper = env.LOGIN_CODE_PEPPER;
  if (!pepper) return fail('not_found');
  const { supabase, user } = session;
  const { current, password } = parsed.data;

  const { data } = await supabase.auth.getClaims();
  if (!signedInByEmailRecently(data?.claims?.amr, Math.floor(Date.now() / 1000))) {
    if (current === undefined) return fail('unauthorized', CURRENT_PASSWORD_REQUIRED);
    const refused = await refuseAttempt(supabase, user.email);
    if (refused) return refused;
    const checked = await supabase.auth.signInWithPassword({
      email: user.email,
      password: derivedPassword(pepper, user.email, current),
    });
    if (checked.error) return fail(isRateLimited(checked.error) ? 'rate_limited' : 'unauthorized');
    await supabase.rpc('login_attempt_clear');
  }

  const { error } = await supabase.auth.updateUser({
    password: derivedPassword(pepper, user.email, password),
  });
  if (error) {
    if (error.code === 'same_password') return fail('conflict');
    return fail(isRateLimited(error) ? 'rate_limited' : 'internal');
  }
  return ok(null);
}
