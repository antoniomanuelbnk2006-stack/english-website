import { parseSsml } from '../ssml';
import { estimateWordEvents } from './estimate-words';
import type { SynthesisResult, TtsProvider } from './types';
import { encodeWav } from './wav';

// Kokoro (Apache 2.0): TTS neuronal que corre en local, sin claves ni límites
// (docs/04-arquitectura/01-stack.md, ADR-0005). Solo tiene voces británicas y estadounidenses,
// y no da tiempos por palabra: se estiman a partir del audio (ver estimate-words.ts).
// La primera vez descarga el modelo (~90 MB) de Hugging Face y lo guarda en caché.

const MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';

/** Voces por acento, de mejor a peor calidad según la ficha del modelo. */
export const KOKORO_VOICES: Record<string, { female: string[]; male: string[] }> = {
  'en-US': {
    female: ['af_heart', 'af_bella', 'af_nicole'],
    male: ['am_michael', 'am_fenrir', 'am_puck'],
  },
  'en-GB': {
    female: ['bf_emma', 'bf_isabella'],
    male: ['bm_george', 'bm_fable'],
  },
};

const ALL_VOICES = new Set(
  Object.values(KOKORO_VOICES).flatMap(({ female, male }) => [...female, ...male]),
);

interface KokoroModel {
  generate(
    text: string,
    options: { voice: string; speed: number },
  ): Promise<{ audio: Float32Array; sampling_rate: number }>;
}

function toInt16(audio: Float32Array): Int16Array {
  const samples = new Int16Array(audio.length);
  for (let i = 0; i < audio.length; i++) {
    const value = Math.max(-1, Math.min(1, audio[i] ?? 0));
    samples[i] = Math.round(value * 32767);
  }
  return samples;
}

export function createKokoroTts(): TtsProvider {
  let model: Promise<KokoroModel> | null = null;
  const load = (): Promise<KokoroModel> => {
    model ??= import('kokoro-js').then(
      ({ KokoroTTS }) =>
        KokoroTTS.from_pretrained(MODEL, {
          dtype: 'q8',
          device: 'cpu',
        }) as unknown as Promise<KokoroModel>,
    );
    return model;
  };

  return {
    id: 'kokoro',
    voicesFor: (accent, gender) => KOKORO_VOICES[accent]?.[gender] ?? [],
    knowsVoice: (voice) => ALL_VOICES.has(voice),

    async synthesize({ ssml, voice }): Promise<SynthesisResult> {
      const { text, rate } = parseSsml(ssml);
      const tts = await load();
      const { audio, sampling_rate: sampleRate } = await tts.generate(text, { voice, speed: rate });
      const samples = toInt16(audio);
      return {
        wav: encodeWav({ sampleRate, samples }),
        words: estimateWordEvents(samples, sampleRate, text),
        sampleRate,
      };
    },
  };
}
