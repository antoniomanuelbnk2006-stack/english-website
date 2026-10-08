import { execFile } from 'node:child_process';

// ffmpeg: normalización de sonoridad en dos pasadas y codificación AAC
// (docs/04-arquitectura/05-audio-y-reproductor.md §1: .m4a AAC-LC mono 64 kbps a −16 LUFS).

export const TARGET_LUFS = -16;
const TRUE_PEAK = -1.5;
const LOUDNESS_RANGE = 11;

function run(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('ffmpeg', args, { maxBuffer: 32 * 1024 * 1024 }, (error, _stdout, stderr) => {
      if (error) {
        const tail = stderr.split('\n').slice(-6).join('\n');
        const missing = (error as NodeJS.ErrnoException).code === 'ENOENT';
        reject(
          new Error(
            missing
              ? 'No se encuentra ffmpeg: instálalo y comprueba que está en el PATH.'
              : `ffmpeg falló:\n${tail}`,
          ),
        );
        return;
      }
      resolve(stderr);
    });
  });
}

interface LoudnessStats {
  input_i: string;
  input_tp: string;
  input_lra: string;
  input_thresh: string;
  target_offset: string;
}

/** Primera pasada de `loudnorm`: mide sin escribir nada. */
async function measure(file: string): Promise<LoudnessStats> {
  const stderr = await run([
    '-hide_banner',
    '-nostats',
    '-i',
    file,
    '-af',
    `loudnorm=I=${TARGET_LUFS}:TP=${TRUE_PEAK}:LRA=${LOUDNESS_RANGE}:print_format=json`,
    '-f',
    'null',
    '-',
  ]);
  const json = /\{[^{}]*"input_i"[^{}]*\}/.exec(stderr)?.[0];
  if (!json) throw new Error('ffmpeg no devolvió las medidas de sonoridad');
  return JSON.parse(json) as LoudnessStats;
}

/** Sonoridad integrada del fichero, en LUFS. */
export async function integratedLoudness(file: string): Promise<number> {
  return Number((await measure(file)).input_i);
}

/**
 * WAV → .m4a (AAC-LC mono 64 kbps) normalizado a −16 LUFS con pico real ≤ −1,5 dBTP.
 * Dos pasadas: la segunda aplica una ganancia lineal con las medidas de la primera, que es
 * más precisa y no «respira» como la normalización dinámica de una sola pasada.
 */
export async function encodeNormalized(
  wavFile: string,
  outFile: string,
  sampleRate: number,
): Promise<{ loudnessLufs: number }> {
  const stats = await measure(wavFile);
  const filter = [
    `loudnorm=I=${TARGET_LUFS}`,
    `TP=${TRUE_PEAK}`,
    `LRA=${LOUDNESS_RANGE}`,
    `measured_I=${stats.input_i}`,
    `measured_TP=${stats.input_tp}`,
    `measured_LRA=${stats.input_lra}`,
    `measured_thresh=${stats.input_thresh}`,
    `offset=${stats.target_offset}`,
    'linear=true',
  ].join(':');

  await run([
    '-hide_banner',
    '-nostats',
    '-y',
    '-i',
    wavFile,
    '-af',
    filter,
    // loudnorm trabaja a 192 kHz por dentro: se vuelve a la frecuencia del TTS.
    '-ar',
    String(sampleRate),
    '-ac',
    '1',
    '-c:a',
    'aac',
    '-b:a',
    '64k',
    '-movflags',
    '+faststart',
    outFile,
  ]);

  return { loudnessLufs: Number((await integratedLoudness(outFile)).toFixed(1)) };
}
