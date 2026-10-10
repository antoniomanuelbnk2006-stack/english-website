// pnpm content:exam-audio --ids b2-exam-01-listening[,…]
// Locuta las grabaciones de una prueba de Listening de un simulacro de examen: cada grabación
// es un fichero aparte (la app la reproduce dos veces, como en el examen). Escribe en la prueba
// la ruta y la duración de cada audio. Después, `pnpm content:upload --ids <id>` los sube a R2
// (o, con --local, los copia a public/dev-audio/).
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { ExamPaper, partRecordings } from '../../src/lib/content/exam-schema';
import { TARGET_LUFS, encodeNormalized } from './lib/ffmpeg';
import { listExamFiles, readJson, splitIds, writeContent } from './lib/io';
import { INITIAL_RATE } from './lib/ssml';
import { CACHE_DIR, getProvider, synthesizeUnits } from './lib/synthesize';
import { buildTimeline } from './lib/timeline';
import { encodeWav } from './lib/tts/wav';
import { assignVoices } from './lib/voices';

type Json = Record<string, unknown>;

const LOUDNESS_TOLERANCE = 1.5;

/** Los objetos de grabación del JSON, en el mismo orden que `partRecordings`. */
function rawRecordings(raw: Json): Json[] {
  return (raw.parts as Json[]).flatMap((part) => {
    if (part.type === 'mcq') {
      return (part.groups as Json[]).flatMap((group) =>
        group.recording ? [group.recording as Json] : [],
      );
    }
    return part.recording ? [part.recording as Json] : [];
  });
}

async function main(): Promise<number> {
  const { values } = parseArgs({ options: { ids: { type: 'string', multiple: true } } });
  const ids = new Set(splitIds(values.ids));
  if (ids.size === 0) {
    console.error('Uso: pnpm content:exam-audio --ids <id>[,<id>…]');
    return 2;
  }
  const files = listExamFiles().filter((file) => ids.has(file.id));
  const missing = [...ids].filter((id) => !files.some((file) => file.id === id));
  if (missing.length > 0) {
    console.error(`No existen estas pruebas: ${missing.join(', ')}`);
    return 2;
  }

  const provider = getProvider();
  let problems = 0;

  for (const { file, id } of files) {
    const raw = readJson(file) as Json;
    const paper = ExamPaper.parse(raw);
    if (paper.paper !== 'listening') {
      console.log(`${id}: no es una prueba de Listening, no lleva audio.`);
      continue;
    }
    const recordings = paper.parts.flatMap(partRecordings);
    const targets = rawRecordings(raw);
    let total = 0;

    for (const [index, recording] of recordings.entries()) {
      const target = targets[index];
      if (!target || target.id !== recording.id) {
        throw new Error(`${id}: las grabaciones del fichero no casan con el esquema`);
      }
      const voices = assignVoices(provider, `${id}:${recording.id}`, recording.speakers);
      const styles = new Map(recording.speakers.map((speaker) => [speaker.id, speaker.style]));
      const { units } = await synthesizeUnits(
        `${id}:${recording.id}`,
        recording.segments.map((segment, position) => ({
          id: `s${position + 1}`,
          speaker: segment.speaker,
          text: segment.text,
          pauseAfterMs: segment.pause_after_ms,
          style: styles.get(segment.speaker),
        })),
        provider,
        voices,
        INITIAL_RATE[paper.level],
      );
      const timeline = buildTimeline(units, paper.level);

      const src = `audio/exams/${paper.level.toLowerCase()}/${id}/v${paper.version}/${recording.id}.m4a`;
      const outFile = path.join(CACHE_DIR, 'out', src);
      const tmpWav = path.join(CACHE_DIR, `${id}.${recording.id}.tmp.wav`);
      mkdirSync(path.dirname(outFile), { recursive: true });
      writeFileSync(tmpWav, encodeWav(timeline.pcm));
      const { loudnessLufs } = await encodeNormalized(tmpWav, outFile, timeline.pcm.sampleRate);
      rmSync(tmpWav, { force: true });

      target.audio = { src, duration_s: timeline.durationS };
      total += timeline.durationS;
      // Las grabaciones cortas (20–30 s) se normalizan con algo menos de precisión que una lección.
      const loudOk = Math.abs(loudnessLufs - TARGET_LUFS) <= LOUDNESS_TOLERANCE;
      console.log(
        `${id} ${recording.id}  ${timeline.durationS.toFixed(1)} s · ${loudnessLufs} LUFS · ` +
          Object.values(voices).join(', '),
      );
      if (!loudOk) {
        console.log(`  ✗ sonoridad fuera de ${TARGET_LUFS} ±${LOUDNESS_TOLERANCE} LUFS`);
        problems++;
      }
    }

    writeContent(file, raw);
    console.log(
      `${id}: ${recordings.length} grabaciones · ${(total / 60).toFixed(1)} min de audio`,
    );
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
