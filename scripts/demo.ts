// pnpm demo            arranca la demo
// pnpm demo --reset    borra antes los datos guardados y empieza de cero
//
// Arranca Señal para probarla sin cuentas ni claves: la app compilada contra el emulador de
// Supabase de los tests (ADR-0011), con el contenido real de content/ y el audio local de
// public/dev-audio/.
//
// Los datos (nivel, progreso, repaso, diario) se guardan en .demo-data/ y siguen ahí al
// volver a arrancar. Aun así no es un entorno de uso real: es un único usuario, en este
// ordenador y sin copias. Para eso hace falta un proyecto de Supabase y un .env.local
// (docs/06-desarrollo/04-entornos-y-despliegue.md).
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';

const APP_PORT = process.env.DEMO_PORT ?? '3000';
const EMULATOR_PORT = '54399';
const EMAIL = 'owner@example.invalid';
const DATA_DIR = path.resolve(process.env.DEMO_DATA_DIR ?? '.demo-data');
const START_TIMEOUT_MS = 120_000;

const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${EMULATOR_PORT}`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'demo',
  NEXT_PUBLIC_AUDIO_BASE_URL: '/dev-audio',
  ALLOWED_EMAIL: EMAIL,
  EMULATOR_PORT,
  EMULATOR_DATA_DIR: DATA_DIR,
};

const next = require.resolve('next/dist/bin/next');
const tsx = require.resolve('tsx/cli');

const children: ChildProcess[] = [];
const stop = (code = 0): never => {
  for (const child of children) child.kill();
  process.exit(code);
};
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());

function start(args: string[]): void {
  const child = spawn(process.execPath, args, { env, stdio: 'inherit' });
  // Si una de las dos partes se cae, la otra sola no sirve de nada.
  child.on('exit', () => stop(1));
  children.push(child);
}

function portFree(port: string, host?: string): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once('error', () => resolve(false));
    probe.once('listening', () => probe.close(() => resolve(true)));
    probe.listen(Number(port), host);
  });
}

/** Espera a que una URL responda bien: el aviso final solo sale cuando todo funciona. */
async function ready(url: string, what: string): Promise<void> {
  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.ok) return;
    } catch {
      // Todavía no escucha.
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  console.error(`${what} no ha arrancado a tiempo (${url}).`);
  stop(1);
}

async function main(): Promise<void> {
  // Otra demo (o los tests e2e) en los mismos puertos: mejor avisar que arrancar a medias.
  const busy = [
    (await portFree(APP_PORT)) ? null : APP_PORT,
    (await portFree(EMULATOR_PORT, '127.0.0.1')) ? null : EMULATOR_PORT,
  ].filter((port) => port !== null);
  if (busy.length > 0) {
    const which =
      busy.length === 1
        ? `el puerto ${busy[0]} ya está en uso`
        : `los puertos ${busy.join(' y ')} ya están en uso`;
    console.error(
      `No se puede arrancar: ${which}.\n` +
        '¿Hay otra demo abierta? Ciérrala (Ctrl+C en su terminal) y vuelve a intentarlo.',
    );
    process.exit(1);
  }

  if (process.argv.includes('--reset') && existsSync(DATA_DIR)) {
    rmSync(DATA_DIR, { recursive: true, force: true });
    console.log(`Datos de la demo borrados (${DATA_DIR}).`);
  }

  console.log('Compilando la app…');
  const build = spawnSync(process.execPath, [next, 'build'], { env, stdio: 'inherit' });
  if (build.status !== 0) process.exit(build.status ?? 1);

  // Primero la base de datos: la app no debe atender a nadie sin ella.
  start([tsx, 'tests/support/supabase-emulator.ts']);
  await ready(`http://127.0.0.1:${EMULATOR_PORT}/health`, 'El emulador de Supabase');
  start([next, 'start', '-p', APP_PORT]);
  await ready(`http://localhost:${APP_PORT}/login`, 'La app');

  console.log(
    [
      '',
      '──────────────────────────────────────────────────────────',
      `  Señal (demostración)   http://localhost:${APP_PORT}`,
      `  Email:  ${EMAIL}`,
      '  Código: 123456',
      `  Tus datos se guardan en ${path.relative(process.cwd(), DATA_DIR) || DATA_DIR}`,
      '  (para empezar de cero: pnpm demo --reset). Ctrl+C para cerrar.',
      '──────────────────────────────────────────────────────────',
      '',
    ].join('\n'),
  );
}

void main();
