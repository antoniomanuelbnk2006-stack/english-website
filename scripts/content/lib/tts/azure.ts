import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import { VOICES } from '../voices';
import type { SynthesisResult, TtsProvider, WordEvent } from './types';

// Azure AI Speech (ADR-0005): voces neuronales con eventos de palabra para el karaoke.
// Solo se usa en el pipeline local; la clave vive en .env.pipeline.

const TICKS_PER_MS = 10_000; // el SDK mide en unidades de 100 ns
const SAMPLE_RATE = 48_000;

export function createAzureTts(): TtsProvider {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) {
    throw new Error(
      'Faltan AZURE_SPEECH_KEY y AZURE_SPEECH_REGION en .env.pipeline ' +
        '(docs/06-desarrollo/04-entornos-y-despliegue.md §5).',
    );
  }

  return {
    id: 'azure',
    voicesFor: (accent, gender) => VOICES[accent]?.[gender] ?? [],

    synthesize({ ssml }): Promise<SynthesisResult> {
      const config = sdk.SpeechConfig.fromSubscription(key, region);
      config.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Riff48Khz16BitMonoPcm;
      // Sin salida de audio: el resultado se recoge en memoria.
      const synthesizer = new sdk.SpeechSynthesizer(config, null);
      const words: WordEvent[] = [];

      synthesizer.wordBoundary = (_sender, event) => {
        if (event.boundaryType !== sdk.SpeechSynthesisBoundaryType.Word) return;
        words.push({
          text: event.text,
          offsetMs: event.audioOffset / TICKS_PER_MS,
          durationMs: event.duration / TICKS_PER_MS,
        });
      };

      return new Promise<SynthesisResult>((resolve, reject) => {
        synthesizer.speakSsmlAsync(
          ssml,
          (result) => {
            synthesizer.close();
            if (result.reason !== sdk.ResultReason.SynthesizingAudioCompleted) {
              reject(new Error(`Azure TTS no completó la síntesis: ${result.errorDetails}`));
              return;
            }
            resolve({ wav: Buffer.from(result.audioData), words, sampleRate: SAMPLE_RATE });
          },
          (error) => {
            synthesizer.close();
            reject(new Error(`Azure TTS: ${error}`));
          },
        );
      });
    },
  };
}
