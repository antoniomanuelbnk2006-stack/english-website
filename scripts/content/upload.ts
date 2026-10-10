// pnpm content:upload --ids b1-lis-001[,…] [--local | --supabase]
// Sube el audio final con caché de un año: el de una lección o, si el id es de una prueba de
// Listening de un simulacro, el de cada una de sus grabaciones.
//   (sin opción)  a Cloudflare R2 (ADR-0004)
//   --supabase    al Storage del proyecto de Supabase (ADR-0019)
//   --local       lo copia a public/dev-audio/ para probar (NEXT_PUBLIC_AUDIO_BASE_URL=/dev-audio)
// LOCAL_AUDIO_DIR cambia esa carpeta (la usan los tests e2e para no pisar el audio real).
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { ExamPaper, partRecordings } from '../../src/lib/content/exam-schema';
import { r2Store, supabaseStore, type AudioStore } from './lib/audio-stores';
import { listExamFiles, listLessonFiles, readJson, splitIds } from './lib/io';
import { CACHE_DIR } from './lib/synthesize';

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      ids: { type: 'string', multiple: true },
      local: { type: 'boolean', default: false },
      supabase: { type: 'boolean', default: false },
    },
  });
  const ids = new Set(splitIds(values.ids));
  if (ids.size === 0) {
    console.error('Uso: pnpm content:upload --ids <id>[,<id>…] [--local | --supabase]');
    return 2;
  }
  const files = listLessonFiles().filter((file) => ids.has(file.id));
  if (!values.local && process.env.CONTENT_DIR) {
    console.error('Con CONTENT_DIR (contenido de prueba) solo se admite --local: no se sube a ningún sitio.');
    return 2;
  }
  const store: AudioStore | null = values.local
    ? null
    : values.supabase
      ? await supabaseStore()
      : r2Store();
  const localDir = path.resolve(process.cwd(), process.env.LOCAL_AUDIO_DIR ?? 'public/dev-audio');
  let problems = 0;

  /** Lo que hay que subir: un audio por lección, o uno por grabación de un simulacro. */
  const targets: { id: string; src: string }[] = [];
  for (const { file, id } of files) {
    const src = (readJson(file) as { audio?: { src?: string } }).audio?.src;
    if (!src) {
      console.error(`${id}: sin audio. Ejecuta antes: pnpm content:audio --ids ${id}`);
      problems++;
      continue;
    }
    targets.push({ id, src });
  }
  for (const { file, id } of listExamFiles().filter((exam) => ids.has(exam.id))) {
    const paper = ExamPaper.parse(readJson(file));
    if (paper.paper === 'speaking') continue;
    for (const recording of paper.parts.flatMap(partRecordings)) {
      if (!recording.audio) {
        console.error(`${id} ${recording.id}: sin audio. Ejecuta antes: pnpm content:exam-audio --ids ${id}`);
        problems++;
        continue;
      }
      targets.push({ id: `${id} ${recording.id}`, src: recording.audio.src });
    }
  }

  for (const { id, src } of targets) {
    const localFile = path.join(CACHE_DIR, 'out', src);
    if (!existsSync(localFile)) {
      console.error(`${id}: no existe ${path.relative(process.cwd(), localFile)}. Vuelve a generar el audio.`);
      problems++;
      continue;
    }

    if (!store) {
      const target = path.join(localDir, src);
      mkdirSync(path.dirname(target), { recursive: true });
      copyFileSync(localFile, target);
      console.log(`${id} → ${path.relative(process.cwd(), target)}`);
      continue;
    }

    const size = statSync(localFile).size;
    const existing = await store.size(src);
    if (existing === size) {
      console.log(`${id}: ${src} ya está subido.`);
      continue;
    }
    if (existing !== null) {
      // Las URLs son inmutables: un audio distinto necesita otra versión, nunca sobrescribir.
      console.error(`${id}: ${src} ya existe en ${store.label} con otro contenido. Sube «version» en el contenido.`);
      problems++;
      continue;
    }
    await store.put(src, readFileSync(localFile));
    console.log(`${id} → ${store.label}/${src} (${(size / 1024).toFixed(0)} KB)`);
  }
  return problems > 0 ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
