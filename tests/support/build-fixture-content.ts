// Contenido de prueba para los tests e2e: `tsx tests/support/build-fixture-content.ts`
//
// Copia content/ a .e2e/content y pasa la lección de escucha de ejemplo por el pipeline real
// (tts → audio → upload --local → index → validate) con un TTS de prueba que genera tonos.
// Así los e2e tienen una lección de escucha «publicada» con audio y tiempos por palabra, y de
// paso se ejercita el pipeline entero (ffmpeg incluido) sin cuentas ni red.
import { execFileSync } from 'node:child_process';
import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FIXTURE_DIR = path.join(ROOT, '.e2e', 'content');
const LISTENING = 'b1-lis-001';

const env = { ...process.env, CONTENT_DIR: FIXTURE_DIR, TTS_PROVIDER: 'fake' };

/** Ejecuta un script del pipeline con el mismo Node, sin pasar por una shell. */
function script(name: string, args: string[] = []): void {
  execFileSync(
    process.execPath,
    [require.resolve('tsx/cli'), `scripts/content/${name}.ts`, ...args],
    {
      cwd: ROOT,
      env,
      stdio: 'inherit',
    },
  );
}

rmSync(path.join(ROOT, '.e2e'), { recursive: true, force: true });
cpSync(path.join(ROOT, 'content'), FIXTURE_DIR, { recursive: true });

script('tts', ['--ids', LISTENING]);
script('audio', ['--ids', LISTENING]);
script('upload', ['--ids', LISTENING, '--local']);

// La lección de prueba se «publica» aquí. El audio son tonos, pero el esquema solo admite
// proveedores reales, así que en este contenido de prueba (y solo en él) se etiqueta como azure.
const file = path.join(FIXTURE_DIR, 'lessons', 'b1', 'listening', `${LISTENING}.json`);
const lesson = JSON.parse(readFileSync(file, 'utf8')) as {
  status: string;
  provenance: Record<string, unknown>;
  audio: Record<string, unknown>;
};
lesson.status = 'published';
lesson.provenance.reviewed_by = 'fixture de tests e2e';
lesson.audio.provider = 'azure';
writeFileSync(file, `${JSON.stringify(lesson, null, 2)}\n`);

script('annotate', ['--ids', LISTENING]);
script('build-index');
script('validate', ['--offline']);
console.log('\nContenido de prueba listo en .e2e/content');
