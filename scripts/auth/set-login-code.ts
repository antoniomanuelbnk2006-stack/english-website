// pnpm auth:set-code <código> [--email tu@correo]     pone o cambia el código fijo de acceso
// pnpm auth:set-code --off [--email tu@correo]        lo quita (queda solo el acceso por correo)
//
// El código fijo (ADR-0020) no se guarda en ningún sitio: se convierte, con el secreto
// LOGIN_CODE_PEPPER, en la contraseña del usuario en Supabase Auth. Este script la cambia con la
// clave *secret* del proyecto. Lee de .env.pipeline: SUPABASE_URL, SUPABASE_SECRET_KEY,
// LOGIN_CODE_PEPPER y, si no se pasa --email, ALLOWED_EMAIL.
import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import { codePassword, FixedCode } from '../../src/features/auth/lib/fixed-code';

// No hay `--on`: el código no se guarda, así que para volver a activarlo hay que escribirlo.
const USAGE = [
  'Uso: pnpm auth:set-code <código de 4 a 8 cifras> [--email tu@correo]   lo pone o lo cambia',
  '     pnpm auth:set-code --off [--email tu@correo]                      lo quita',
  'Para volver a activarlo después de quitarlo, escribe el código otra vez: pnpm auth:set-code <código>',
].join('\n');

function readArgs() {
  try {
    return parseArgs({
      allowPositionals: true,
      options: { email: { type: 'string' }, off: { type: 'boolean', default: false } },
    });
  } catch {
    return null;
  }
}

async function main(): Promise<number> {
  const args = readArgs();
  if (!args) {
    console.error(USAGE);
    return 2;
  }
  const { values, positionals } = args;
  const { SUPABASE_URL, SUPABASE_SECRET_KEY, LOGIN_CODE_PEPPER } = process.env;
  const email = (values.email ?? process.env.ALLOWED_EMAIL ?? '').trim().toLowerCase();
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    console.error('Faltan SUPABASE_URL o SUPABASE_SECRET_KEY en .env.pipeline.');
    return 2;
  }
  if (!email) {
    console.error('Falta el email: pásalo con --email o pon ALLOWED_EMAIL en .env.pipeline.');
    return 2;
  }

  let password: string;
  if (values.off) {
    // Una contraseña al azar que nadie conoce: el código fijo deja de valer.
    password = randomBytes(32).toString('base64url');
  } else {
    const code = FixedCode.safeParse(positionals[0]);
    if (!code.success) {
      console.error(USAGE);
      return 2;
    }
    if (!LOGIN_CODE_PEPPER || LOGIN_CODE_PEPPER.length < 32) {
      console.error('Falta LOGIN_CODE_PEPPER (32 caracteres o más) en .env.pipeline.');
      return 2;
    }
    password = codePassword(LOGIN_CODE_PEPPER, email, code.data);
  }

  const api = `${SUPABASE_URL.replace(/\/+$/, '')}/auth/v1/admin/users`;
  const headers = {
    apikey: SUPABASE_SECRET_KEY,
    Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
    'Content-Type': 'application/json',
  };
  const list = await fetch(`${api}?per_page=200`, { headers });
  if (!list.ok) throw new Error(`No se pudo leer los usuarios (HTTP ${list.status}).`);
  const { users } = (await list.json()) as { users: { id: string; email?: string }[] };
  const user = users.find((candidate) => candidate.email?.toLowerCase() === email);
  if (!user) {
    console.error(`No hay ningún usuario con el email ${email} en el proyecto.`);
    return 1;
  }

  const update = await fetch(`${api}/${user.id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ password }),
  });
  if (!update.ok) {
    const detail = (await update.text()).slice(0, 200);
    throw new Error(`No se pudo cambiar (HTTP ${update.status}): ${detail}`);
  }
  console.log(
    values.off
      ? `Código fijo desactivado para ${email}. Ya no se puede entrar con él: para volver a ponerlo, pnpm auth:set-code <código>.`
      : `Código fijo cambiado para ${email}. Vale desde ahora.`,
  );
  return 0;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
