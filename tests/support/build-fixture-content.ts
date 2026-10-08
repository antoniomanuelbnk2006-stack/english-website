// Contenido de prueba para los tests e2e: `tsx tests/support/build-fixture-content.ts`
//
// Copia a .e2e/content un conjunto FIJO de lecciones (así añadir contenido real no cambia lo
// que ven los tests) y pasa la lección de escucha por el pipeline real
// (tts → audio → upload --local → index → validate) con un TTS de prueba que genera tonos.
// De paso se ejercita el pipeline entero (ffmpeg incluido) sin cuentas ni red.
//
// El audio de prueba vive aparte del real: su caché en .e2e/audio-cache y sus ficheros en
// public/dev-audio/e2e (la app de los tests usa NEXT_PUBLIC_AUDIO_BASE_URL=/dev-audio/e2e).
import { execFileSync } from 'node:child_process';
import { cpSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FIXTURE_DIR = path.join(ROOT, '.e2e', 'content');
const LISTENING = 'b1-lis-001';
/** Lo único que ven los tests, por mucho que crezca content/. */
const LESSONS = new Set(['b1-rea-001', LISTENING]);
const USE_OF_ENGLISH = new Set(['b2-uoe-001', 'b2-uoe-002', 'b2-uoe-003', 'b2-uoe-004']);

const env = {
  ...process.env,
  CONTENT_DIR: FIXTURE_DIR,
  TTS_PROVIDER: 'fake',
  AUDIO_CACHE_DIR: path.join(ROOT, '.e2e', 'audio-cache'),
  LOCAL_AUDIO_DIR: path.join(ROOT, 'public', 'dev-audio', 'e2e'),
};

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

/** Borra de una carpeta (recursivamente) los `.json` cuyo nombre no esté en la lista. */
function keepOnly(dir: string, ids: ReadonlySet<string>): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return; // la carpeta aún no existe en content/
  }
  for (const entry of entries) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) keepOnly(full, ids);
    else if (entry.endsWith('.json') && !ids.has(entry.slice(0, -'.json'.length))) rmSync(full);
  }
}

rmSync(path.join(ROOT, '.e2e'), { recursive: true, force: true });
rmSync(env.LOCAL_AUDIO_DIR, { recursive: true, force: true });
cpSync(path.join(ROOT, 'content'), FIXTURE_DIR, { recursive: true });
keepOnly(path.join(FIXTURE_DIR, 'lessons'), LESSONS);
keepOnly(path.join(FIXTURE_DIR, 'use-of-english'), USE_OF_ENGLISH);

const file = path.join(FIXTURE_DIR, 'lessons', 'b1', 'listening', `${LISTENING}.json`);
type Fixture = {
  status: string;
  provenance: Record<string, unknown>;
  audio: Record<string, unknown>;
};
const read = () => JSON.parse(readFileSync(file, 'utf8')) as Fixture;

script('tts', ['--ids', LISTENING]);
script('audio', ['--ids', LISTENING]);
script('upload', ['--ids', LISTENING, '--local']);

// La lección de prueba se «publica» aquí. El audio son tonos, pero el esquema solo admite
// proveedores reales, así que en este contenido de prueba (y solo en él) se etiqueta como azure.
const lesson = read();
lesson.status = 'published';
lesson.provenance.reviewed_by = 'fixture de tests e2e';
lesson.audio.provider = 'azure';
writeFileSync(file, `${JSON.stringify(lesson, null, 2)}\n`);

script('annotate', ['--ids', LISTENING]);
script('build-index');
script('validate', ['--offline']);
console.log('\nContenido de prueba listo en .e2e/content');
