import 'server-only';
import { signedInByEmailRecently } from '@/features/auth/lib/recent-sign-in';
import { requireUser } from '@/lib/auth';

/**
 * ¿Hace falta la contraseña actual para poner una nueva? (ADR-0031). No, si se acaba de entrar
 * con el correo; sí, en cualquier otro caso (y si no hay sesión).
 */
export async function passwordChangeNeedsCurrent(): Promise<boolean> {
  const session = await requireUser();
  if (!session.ok) return true;
  const { data } = await session.supabase.auth.getClaims();
  return !signedInByEmailRecently(data?.claims?.amr, Math.floor(Date.now() / 1000));
}
