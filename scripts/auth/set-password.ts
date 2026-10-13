// pnpm auth:set-password [--email tu@correo]              pide la contraseña (sin mostrarla) y la pone
// pnpm auth:set-password --generate [--email tu@correo]   genera una al azar, la pone y la enseña una vez
// pnpm auth:set-password --off [--email tu@correo]        la quita (queda solo el acceso por correo)
//
// La contraseña de acceso (ADR-0026) no se guarda en ningún sitio: se convierte, con el secreto
// LOGIN_CODE_PEPPER, en la contraseña del usuario en Supabase Auth. Este script la cambia con la
// clave *secret* del proyecto. Lee de .env.pipeline: SUPABASE_URL, SUPABASE_SECRET_KEY,
// LOGIN_CODE_PEPPER y, si no se pasa --email, ALLOWED_EMAIL.
//
// La contraseña nunca va como argumento: quedaría escrita en el historial del terminal.
//
// De paso pone a cero la cuenta de intentos fallidos (ADR-0024): si el acceso está bloqueado,
// volver a poner la contraseña lo reabre.
import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import {
  derivedPassword,
  generatePassword,
  Password,
  PEPPER_MIN_LENGTH,
} from '../../src/features/auth/lib/password';
import { PASSWORD_MIN_LENGTH } from '../../src/features/auth/lib/password-rules';

const USAGE = [
  'Uso: pnpm auth:set-password [--email tu@correo]              te la pide (no se ve al escribir)',
  '     pnpm auth:set-password --generate [--email tu@correo]   genera una y te la enseña una vez',
  '     pnpm auth:set-password --off [--email tu@correo]        la quita',
  `La contraseña tiene ${PASSWORD_MIN_LENGTH} caracteres o más y no se pasa como argumento.`,
].join('\n');

function readArgs() {
  try {
    return parseArgs({
      allowPositionals: true,
      options: {
        email: { type: 'string' },
        off: { type: 'boolean', default: false },
        generate: { type: 'boolean', default: false },
      },
    });
  } catch {
    return null;
  }
}

/**
 * Lee una línea del teclado sin mostrarla. Si la entrada no es un teclado (viene de una
 * tubería), devuelve su primera línea.
 */
function readSecret(prompt: string): Promise<string> {
  const { stdin, stdout } = process;
  stdin.setEncoding('utf8');
  if (!stdin.isTTY) {
    return new Promise((resolve) => {
      let data = '';
      stdin.on('data', (chunk: string) => (data += chunk));
      stdin.on('end', () => resolve(data.split(/\r?\n/)[0] ?? ''));
    });
  }
  return new Promise((resolve, reject) => {
    let value = '';
    const finish = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off('data', onData);
      stdout.write('\n');
    };
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n') {
          finish();
          return resolve(value);
        }
        if (char === '\u0003') {
          finish();
          return reject(new Error('Cancelado: no se ha cambiado nada.'));
        }
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else if (char >= ' ') value += char;
      }
    };
    stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
  });
}

/** La contraseña que se va a poner: generada, o escrita dos veces para descartar erratas. */
async function choosePassword(generate: boolean): Promise<string | null> {
  if (generate) return generatePassword();

  const first = await readSecret(`Contraseña nueva (${PASSWORD_MIN_LENGTH} caracteres o más): `);
  if (!Password.safeParse(first).success) {
    console.error(
      `No vale: tiene ${first.length} caracteres y hacen falta ${PASSWORD_MIN_LENGTH} o más. No se ha cambiado nada.`,
    );
    return null;
  }
  if (process.stdin.isTTY) {
    const second = await readSecret('Otra vez, para confirmar: ');
    if (second !== first) {
      console.error('No coinciden. No se ha cambiado nada.');
      return null;
    }
  }
  return first;
}

async function main(): Promise<number> {
  const args = readArgs();
  if (!args || (args.values.off && args.values.generate)) {
    console.error(USAGE);
    return 2;
  }
  const { values, positionals } = args;
  if (positionals.length > 0) {
    console.error(
      'La contraseña no se pasa como argumento: quedaría en el historial del terminal.\n' +
        'Si acabas de escribir una ahí, no la uses.\n\n' +
        USAGE,
    );
    return 2;
  }
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

  let chosen: string | null = null;
  let password: string;
  if (values.off) {
    // Una contraseña al azar que nadie conoce: ya no se puede entrar con ninguna.
    password = randomBytes(32).toString('base64url');
  } else {
    if (!LOGIN_CODE_PEPPER || LOGIN_CODE_PEPPER.length < PEPPER_MIN_LENGTH) {
      console.error(
        `Falta LOGIN_CODE_PEPPER (${PEPPER_MIN_LENGTH} caracteres o más) en .env.pipeline.`,
      );
      return 2;
    }
    chosen = await choosePassword(values.generate);
    if (chosen === null) return 1;
    password = derivedPassword(LOGIN_CODE_PEPPER, email, chosen);
  }

  const project = SUPABASE_URL.replace(/\/+$/, '');
  const api = `${project}/auth/v1/admin/users`;
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

  // Poner la contraseña levanta también el bloqueo por intentos fallidos (ADR-0024): es la
  // forma de reabrir el acceso desde tu ordenador si alguien lo ha dejado cerrado.
  const unlock = await fetch(`${project}/rest/v1/login_attempts?user_id=eq.${user.id}`, {
    method: 'DELETE',
    headers,
  });
  if (!unlock.ok) {
    console.warn(
      `Aviso: no se pudo poner a cero la cuenta de intentos (HTTP ${unlock.status}). ` +
        '¿Está aplicada la migración 0005?',
    );
  }

  if (values.off) {
    console.log(
      `Contraseña desactivada para ${email}. Solo se puede entrar con el enlace del correo; ` +
        'para volver a ponerla, pnpm auth:set-password.',
    );
  } else if (values.generate) {
    console.log(
      `Contraseña nueva para ${email}. Solo se enseña ahora: guárdala en tu gestor de contraseñas.\n\n` +
        `    ${chosen}\n\nVale desde ahora.`,
    );
  } else {
    console.log(`Contraseña cambiada para ${email}. Vale desde ahora.`);
  }
  return 0;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
