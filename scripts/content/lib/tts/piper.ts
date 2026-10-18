import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseSsml } from '../ssml';
import { estimateWordEvents } from './estimate-words';
import type { SynthesisResult, TtsProvider } from './types';
import { parseWav } from './wav';

// Piper (MIT): TTS neuronal que corre en local, sin claves ni límites. Es el que da voz al
// español, porque Kokoro solo tiene voces de inglés (ADR-0038). Como Kokoro, no da tiempos por
// palabra: se estiman a partir del audio (ver estimate-words.ts).
//
// Hace falta un Piper y sus voces en una carpeta (`PIPER_DIR`, por defecto `.piper/`):
//   .piper/piper/piper.exe                      (release de rhasspy/piper)
//   .piper/voices/<modelo>.onnx y .onnx.json    (rhasspy/piper-voices en Hugging Face)
// Las voces y sus licencias están en content/wordlists/LICENSES.md.

interface PiperVoice {
  /** Fichero del modelo, sin carpeta. */
  model: string;
  /** Número de hablante, si el modelo trae varios. */
  speaker?: number;
}

/** Las voces por nombre. Los dos hablantes de `sharvard` son uno masculino y otro femenino. */
const VOICES: Record<string, PiperVoice> = {
  'sharvard-m': { model: 'sharvard_medium_es_ES-sharvard-medium.onnx', speaker: 0 },
  'sharvard-f': { model: 'sharvard_medium_es_ES-sharvard-medium.onnx', speaker: 1 },
  'davefx-m': { model: 'davefx_medium_es_ES-davefx-medium.onnx' },
};

/** Voces por acento, de mejor a peor. */
export const PIPER_VOICES: Record<string, { female: string[]; male: string[] }> = {
  'es-ES': { female: ['sharvard-f'], male: ['sharvard-m', 'davefx-m'] },
};

function piperDir(): string {
  return path.resolve(process.cwd(), process.env.PIPER_DIR ?? '.piper');
}

function run(exe: string, args: string[], text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Con la carpeta del ejecutable como directorio de trabajo, encuentra espeak-ng-data.
    const child = spawn(exe, args, { cwd: path.dirname(exe), stdio: ['pipe', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => (stderr += String(chunk)));
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`piper terminó con código ${code}: ${stderr.slice(-400)}`)),
    );
    child.stdin.end(`${text.replace(/\s+/g, ' ').trim()}\n`);
  });
}

export function createPiperTts(): TtsProvider {
  const dir = piperDir();
  const exe = path.join(dir, 'piper', process.platform === 'win32' ? 'piper.exe' : 'piper');

  return {
    id: 'piper',
    voicesFor: (accent, gender) => PIPER_VOICES[accent]?.[gender] ?? [],
    knowsVoice: (voice) => voice in VOICES,

    async synthesize({ ssml, voice }): Promise<SynthesisResult> {
      const entry = VOICES[voice];
      if (!entry) throw new Error(`Piper no tiene la voz «${voice}»`);
      const model = path.join(dir, 'voices', entry.model);
      if (!existsSync(exe) || !existsSync(model)) {
        throw new Error(
          `Falta Piper o su voz en ${dir} (ver scripts/content/lib/tts/piper.ts): ${exe} · ${model}`,
        );
      }
      const { text, rate } = parseSsml(ssml);
      const work = mkdtempSync(path.join(tmpdir(), 'senal-piper-'));
      try {
        const out = path.join(work, 'voz.wav');
        const args = ['--model', model, '--output_file', out, '--length_scale', String(1 / rate)];
        if (entry.speaker !== undefined) args.push('--speaker', String(entry.speaker));
        await run(exe, args, text);
        const wav = readFileSync(out);
        const { samples, sampleRate } = parseWav(wav);
        return { wav, words: estimateWordEvents(samples, sampleRate, text), sampleRate };
      } finally {
        rmSync(work, { recursive: true, force: true });
      }
    },
  };
}
