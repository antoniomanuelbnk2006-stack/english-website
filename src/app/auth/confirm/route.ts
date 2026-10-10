import { NextResponse, type NextRequest } from 'next/server';
import { AuthCode, LINK_ERROR } from '@/features/auth/lib/confirm';
import { env } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';

// Llegada desde el enlace del correo de acceso (docs/adr/0018-acceso-con-enlace-del-correo.md).
// Supabase comprueba el enlace y vuelve aquí con un código de un solo uso, que se canjea por la
// sesión. Solo funciona en el navegador que pidió el correo: ahí está la otra mitad del canje.

export async function GET(request: NextRequest) {
  const to = (pathname: string, error?: string) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = error ? `?error=${error}` : '';
    return NextResponse.redirect(url);
  };

  const code = AuthCode.safeParse(request.nextUrl.searchParams.get('code'));
  if (!code.success) return to('/login', LINK_ERROR);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code.data);
  if (error) return to('/login', LINK_ERROR);

  // Misma barrera que en el resto de la app: solo entra el email permitido.
  if (data.user?.email?.toLowerCase() !== env.ALLOWED_EMAIL) {
    await supabase.auth.signOut();
    return to('/login', LINK_ERROR);
  }
  return to('/hoy');
}
