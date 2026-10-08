import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { LessonDraft } from '../../../src/lib/content/schema';
import { todayMadrid } from '../../../src/lib/dates';
import { INITIAL_RATE, MAX_RATE, MIN_RATE, buildSsml } from './ssml';
import { buildTimeline, speechRate, withinRateTolerance, type UnitAudio } from './timeline';
import { createAzureTts } from './tts/azure';
import { fakeTts } from './tts/fake';
import { createKokoroTts } from './tts/kokoro';
import type { SynthesisResult, TtsProvider, WordEvent } from './tts/types';
import { parseWav, trimSilence } from './tts/wav';
import { assignVoices, type VoiceRequest } from './voices';

// Síntesis de una lección con caché local: re-ejecutar no vuelve a gastar caracteres del TTS
// (docs/05-contenido/01-pipeline.md §3.5).

// (Los tests e2e usan su propia carpeta con AUDIO_CACHE_DIR: su audio de prueba no debe
// mezclarse nunca con el real.)
export const CACHE_DIR = path.resolve(
  process.cwd(),
  process.env.AUDIO_CACHE_DIR ?? '.audio-cache',
);
/** Capa gratuita de Azure AI Speech: 0,5 M de caracteres de voces neuronales al mes. */
export const FREE_CHARS_PER_MONTH = 500_000;

export function getProvider(): TtsProvider {
  const name = process.env.TTS_PROVIDER ?? 'azure';
  if (name === 'azure') return createAzureTts();
  if (name === 'kokoro') return createKokoroTts();
  if (name === 'fake') {
    // Tonos en vez de voz: solo para el contenido de prueba de los tests, nunca para content/.
    if (!process.env.CONTENT_DIR) {
      throw new Error('TTS_PROVIDER=fake solo se admite con CONTENT_DIR apuntando a contenido de prueba');
    }
    return fakeTts;
  }
  throw new Error(`TTS_PROVIDER=${name} no está implementado (valores: azure, kokoro)`);
}

export interface SpokenUnit {
  id: string;
  speaker: string;
  text: string;
  pauseAfterMs?: number;
  style?: string;
}

const NARRATOR = 'narrator';

/** Unidades que se locutan: segmentos de una escucha o frases de una lectura. */
export function spokenUnits(lesson: LessonDraft): { units: SpokenUnit[]; speakers: VoiceRequest[] } {
  if (lesson.skill === 'listening') {
    const styles = new Map(lesson.speakers.map((speaker) => [speaker.id, speaker.style]));
    return {
      units: lesson.segments.map((segment) => ({
        id: segment.id,
        speaker: segment.speaker,
        text: segment.text,
        pauseAfterMs: segment.pause_after_ms,
        style: styles.get(segment.speaker),
      })),
      speakers: lesson.speakers.map(({ id, accent, gender, voice }) => ({ id, accent, gender, voice })),
    };
  }
  // Lectura + audio: un solo narrador, con una pausa algo mayor entre párrafos.
  return {
    units: lesson.paragraphs.flatMap((paragraph) =>
      paragraph.sentences.map((sentence, index) => ({
        id: sentence.id,
        speaker: NARRATOR,
        text: sentence.text,
        pauseAfterMs: index === paragraph.sentences.length - 1 ? 700 : undefined,
      })),
    ),
    speakers: [{ id: NARRATOR, accent: 'en-GB', gender: 'male' }],
  };
}

interface CachedSynthesis {
  wav: Buffer;
  words: WordEvent[];
  sampleRate: number;
  cached: boolean;
}

function monthKey(now: Date): string {
  return todayMadrid(now).slice(0, 7);
}

/** Caracteres enviados al TTS este mes (solo cuentan las peticiones reales, no la caché). */
export function charsUsedThisMonth(now = new Date()): number {
  const file = path.join(CACHE_DIR, 'usage.json');
  if (!existsSync(file)) return 0;
  const usage = JSON.parse(readFileSync(file, 'utf8')) as Record<string, number>;
  return usage[monthKey(now)] ?? 0;
}

function addUsage(chars: number, now = new Date()): void {
  const file = path.join(CACHE_DIR, 'usage.json');
  const usage = existsSync(file)
    ? (JSON.parse(readFileSync(file, 'utf8')) as Record<string, number>)
    : {};
  usage[monthKey(now)] = (usage[monthKey(now)] ?? 0) + chars;
  writeFileSync(file, `${JSON.stringify(usage, null, 2)}\n`);
}

async function synthesizeCached(
  provider: TtsProvider,
  voice: string,
  ssml: string,
): Promise<CachedSynthesis> {
  mkdirSync(CACHE_DIR, { recursive: true });
  const hash = createHash('sha256').update(`${provider.id}\n${voice}\n${ssml}`).digest('hex');
  const wavFile = path.join(CACHE_DIR, `${hash}.wav`);
  const metaFile = path.join(CACHE_DIR, `${hash}.json`);

  if (existsSync(wavFile) && existsSync(metaFile)) {
    const meta = JSON.parse(readFileSync(metaFile, 'utf8')) as Omit<SynthesisResult, 'wav'>;
    return { wav: readFileSync(wavFile), ...meta, cached: true };
  }

  const result = await provider.synthesize({ ssml, voice });
  writeFileSync(wavFile, result.wav);
  writeFileSync(metaFile, JSON.stringify({ words: result.words, sampleRate: result.sampleRate }));
  if (provider.id === 'azure') addUsage(ssml.length);
  return { ...result, cached: false };
}

export interface LessonAudio {
  provider: TtsProvider['id'];
  voices: Record<string, string>;
  rate: number;
  units: UnitAudio[];
  /** Caracteres enviados al TTS en esta ejecución (0 si todo salió de la caché). */
  charsSent: number;
}

async function synthesizeAt(
  lesson: LessonDraft,
  provider: TtsProvider,
  voices: Record<string, string>,
  rate: number,
): Promise<{ units: UnitAudio[]; charsSent: number }> {
  const { units } = spokenUnits(lesson);
  const out: UnitAudio[] = [];
  let charsSent = 0;

  for (const unit of units) {
    const voice = voices[unit.speaker];
    if (!voice) throw new Error(`${lesson.id}: el hablante «${unit.speaker}» no tiene voz`);
    const ssml = buildSsml({ text: unit.text, voice, rate, style: unit.style });
    const result = await synthesizeCached(provider, voice, ssml);
    if (!result.cached) charsSent += ssml.length;

    // El silencio propio del TTS se recorta: las pausas las pone el pipeline.
    const { pcm, trimmedStartMs } = trimSilence(parseWav(result.wav));
    out.push({
      id: unit.id,
      speaker: unit.speaker,
      pcm,
      words: result.words.map((word) => ({
        ...word,
        offsetMs: Math.max(0, word.offsetMs - trimmedStartMs),
      })),
      pauseAfterMs: unit.pauseAfterMs,
    });
  }
  return { units: out, charsSent };
}

/** Velocidad objetivo: la de la lección de escucha, o una cómoda para leer en voz alta. */
export function targetWpm(lesson: LessonDraft): number {
  if (lesson.skill === 'listening') return lesson.target_wpm;
  return { A1: 100, A2: 115, B1: 135, B2: 150, C1: 160, C2: 170 }[lesson.level];
}

/**
 * Locuta la lección entera y ajusta la velocidad hasta quedar dentro del ±8 % de la objetivo
 * (como mucho tres intentos; los que ya se hicieron salen de la caché).
 */
export async function synthesizeLesson(
  lesson: LessonDraft,
  provider: TtsProvider,
  wordCount: number,
): Promise<LessonAudio & { wpm: number }> {
  const { speakers } = spokenUnits(lesson);
  const voices = assignVoices(provider, lesson.id, speakers);
  const target = targetWpm(lesson);

  let rate = INITIAL_RATE[lesson.level];
  let charsSent = 0;
  let units: UnitAudio[] = [];
  let wpm = 0;

  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await synthesizeAt(lesson, provider, voices, rate);
    units = result.units;
    charsSent += result.charsSent;
    wpm = speechRate(wordCount, buildTimeline(units, lesson.level).durationS);
    if (withinRateTolerance(wpm, target)) break;

    const next = Math.min(MAX_RATE, Math.max(MIN_RATE, Number((rate * (target / wpm)).toFixed(2))));
    if (next === rate) break; // no se puede acercar más sin que la voz deje de sonar natural
    rate = next;
  }

  return { provider: provider.id, voices, rate, units, charsSent, wpm };
}
