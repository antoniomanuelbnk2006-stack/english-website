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
import path from 'node:path';

const APP_PORT = process.env.DEMO_PORT ?? '3000';
const EMULATOR_PORT = '54399';
const EMAIL = 'owner@example.invalid';
const DATA_DIR = path.resolve(process.env.DEMO_DATA_DIR ?? '.demo-data');

if (process.argv.includes('--reset') && existsSync(DATA_DIR)) {
  rmSync(DATA_DIR, { recursive: true, force: true });
  console.log(`Datos de la demo borrados (${DATA_DIR}).`);
}

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

console.log('Compilando la app…');
const build = spawnSync(process.execPath, [next, 'build'], { env, stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status ?? 1);

const children: ChildProcess[] = [
  spawn(process.execPath, [tsx, 'tests/support/supabase-emulator.ts'], { env, stdio: 'inherit' }),
  spawn(process.execPath, [next, 'start', '-p', APP_PORT], { env, stdio: 'inherit' }),
];

const stop = () => {
  for (const child of children) child.kill();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const child of children) child.on('exit', stop);

setTimeout(() => {
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
}, 4000);
