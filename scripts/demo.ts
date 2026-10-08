// pnpm demo
// Arranca Señal para probarla sin cuentas ni claves: la app compilada contra el emulador de
// Supabase en memoria de los tests (ADR-0011), con el contenido real de content/ y el audio
// local de public/dev-audio/.
//
// OJO: los datos viven en memoria y se pierden al cerrar. No es un entorno de uso real: para
// eso hace falta un proyecto de Supabase y un .env.local (docs/06-desarrollo/04-entornos-y-despliegue.md).
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';

const APP_PORT = process.env.DEMO_PORT ?? '3000';
const EMULATOR_PORT = '54399';
const EMAIL = 'owner@example.invalid';

const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${EMULATOR_PORT}`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'demo',
  NEXT_PUBLIC_AUDIO_BASE_URL: '/dev-audio',
  ALLOWED_EMAIL: EMAIL,
  EMULATOR_PORT,
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
      '  Los datos se pierden al cerrar (Ctrl+C).',
      '──────────────────────────────────────────────────────────',
      '',
    ].join('\n'),
  );
}, 4000);
