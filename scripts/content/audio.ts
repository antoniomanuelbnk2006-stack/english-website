// pnpm content:audio --ids b1-lis-001[,…]
// Une los segmentos con sus pausas, normaliza a −16 LUFS, codifica AAC y escribe en la lección
// los tiempos de cada segmento y palabra, la duración, la velocidad real y los picos de la onda.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { LessonDraft } from '../../src/lib/content/schema';
import { annotateLesson } from './lib/annotate-lesson';
import { TARGET_LUFS, encodeNormalized } from './lib/ffmpeg';
import { listLessonFiles, readJson, splitIds, writeContent } from './lib/io';
import { countWords, type TokenT } from './lib/nlp';
import { CACHE_DIR, getProvider, synthesizeLesson, targetWpm } from './lib/synthesize';
import {
  alignTokens,
  buildTimeline,
  computePeaks,
  speechRate,
  withinRateTolerance,
} from './lib/timeline';
import { encodeWav } from './lib/tts/wav';
import { loadWordLists } from './lib/wordlists';

type Json = Record<string, unknown>;

async function main(): Promise<number> {
  const { values } = parseArgs({ options: { ids: { type: 'string', multiple: true } } });
  const ids = new Set(splitIds(values.ids));
  if (ids.size === 0) {
    console.error('Uso: pnpm content:audio --ids <id>[,<id>…]');
    return 2;
  }
  const files = listLessonFiles().filter((file) => ids.has(file.id));
  const missing = [...ids].filter((id) => !files.some((file) => file.id === id));
  if (missing.length > 0) {
    console.error(`No existen estas lecciones: ${missing.join(', ')}`);
    return 2;
  }

  const provider = getProvider();
  const lists = loadWordLists();
  let problems = 0;

  for (const { file, id } of files) {
    const raw = readJson(file) as Json;
    const lesson = LessonDraft.parse(raw);
    if (lesson.skill === 'reading' && !lesson.with_audio) {
      console.log(`${id}: with_audio es false, no lleva audio.`);
      continue;
    }

    const units =
      lesson.skill === 'listening'
        ? (raw.segments as Json[])
        : (raw.paragraphs as Json[]).flatMap((paragraph) => paragraph.sentences as Json[]);
    if (!units.every((unit) => Array.isArray(unit.tokens))) {
      console.error(`${id}: sin anotar. Ejecuta antes: pnpm content:annotate --ids ${id}`);
      problems++;
      continue;
    }
    const wordCount = units.reduce((sum, unit) => sum + countWords(unit.tokens as TokenT[]), 0);

    // Sale de la caché de content:tts; si faltara algún segmento, se locuta ahora.
    const audio = await synthesizeLesson(lesson, provider, wordCount);
    const timeline = buildTimeline(audio.units, lesson.level);

    const src = `audio/${lesson.level.toLowerCase()}/${lesson.id}/v${lesson.version}.m4a`;
    const outFile = path.join(CACHE_DIR, 'out', src);
    const tmpWav = path.join(CACHE_DIR, `${lesson.id}.tmp.wav`);
    mkdirSync(path.dirname(outFile), { recursive: true });
    writeFileSync(tmpWav, encodeWav(timeline.pcm));
    const { loudnessLufs } = await encodeNormalized(tmpWav, outFile, timeline.pcm.sampleRate);
    rmSync(tmpWav, { force: true });

    units.forEach((unit, index) => {
      const timed = timeline.units[index];
      if (!timed) return;
      unit.start = timed.start;
      unit.end = timed.end;
      unit.tokens = alignTokens(unit.tokens as TokenT[], timed);
    });

    const wpm = speechRate(wordCount, timeline.durationS);
    raw.audio = {
      src,
      duration_s: timeline.durationS,
      wpm,
      provider: audio.provider,
      voices: audio.voices,
      loudness_lufs: loudnessLufs,
      peaks: computePeaks(timeline.pcm.samples),
    };
    // La dificultad de una escucha depende de la velocidad real: se recalcula.
    const { lesson: annotated, metrics } = annotateLesson(raw, lists, new Date());
    writeContent(file, annotated);

    const target = targetWpm(lesson);
    const rateOk = withinRateTolerance(wpm, target);
    const loudOk = Math.abs(loudnessLufs - TARGET_LUFS) <= 1;
    console.log(
      `${id}  ${timeline.durationS.toFixed(1)} s · ${wpm} ppm (objetivo ${target}) · ` +
        `${loudnessLufs} LUFS · dificultad ${metrics.difficulty} → ${path.relative(process.cwd(), outFile)}`,
    );
    if (!rateOk) console.log('  ✗ velocidad fuera del ±8 % del objetivo');
    if (!loudOk) console.log(`  ✗ sonoridad fuera de ${TARGET_LUFS} ±1 LUFS`);
    if (!rateOk || !loudOk) problems++;
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
