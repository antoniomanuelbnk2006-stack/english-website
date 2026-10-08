import type { TokenT } from './nlp';
import type { WordEvent } from './tts/types';
import type { Pcm } from './tts/wav';
import type { Cefr } from './wordlists';

// Línea de tiempo del audio final: une los segmentos con sus pausas y calcula cuándo suena
// cada palabra (docs/04-arquitectura/05-audio-y-reproductor.md §2). Lógica pura.

const round3 = (seconds: number) => Number(seconds.toFixed(3));

/** Pausa tras un segmento: 250 ms si sigue el mismo hablante, 400 ms si cambia; más en A1–A2. */
export function pauseAfterMs(level: Cefr, speakerChanges: boolean, override?: number): number {
  if (override !== undefined) return override;
  const slow = level === 'A1' || level === 'A2';
  if (speakerChanges) return slow ? 700 : 400;
  return slow ? 500 : 250;
}

export interface UnitAudio {
  id: string;
  speaker: string;
  pcm: Pcm;
  /** Eventos de palabra con tiempos relativos al inicio de `pcm`. */
  words: WordEvent[];
  pauseAfterMs?: number;
}

export interface TimedWord {
  text: string;
  s: number;
  e: number;
}

export interface TimedUnit {
  id: string;
  start: number;
  end: number;
  words: TimedWord[];
}

export interface Timeline {
  pcm: Pcm;
  units: TimedUnit[];
  durationS: number;
}

export function buildTimeline(units: readonly UnitAudio[], level: Cefr): Timeline {
  const sampleRate = units[0]?.pcm.sampleRate ?? 24_000;
  if (units.some((unit) => unit.pcm.sampleRate !== sampleRate)) {
    throw new Error('todos los segmentos deben tener la misma frecuencia de muestreo');
  }

  // Las pausas se colocan en muestras enteras: así los tiempos son exactos por construcción.
  const pieces: Int16Array[] = [];
  const timed: TimedUnit[] = [];
  let cursor = 0; // en muestras

  units.forEach((unit, index) => {
    const startS = cursor / sampleRate;
    pieces.push(unit.pcm.samples);
    cursor += unit.pcm.samples.length;
    const endS = cursor / sampleRate;
    timed.push({
      id: unit.id,
      start: round3(startS),
      end: round3(endS),
      words: unit.words.map((word) => ({
        text: word.text,
        s: round3(Math.min(endS, startS + word.offsetMs / 1000)),
        e: round3(Math.min(endS, startS + (word.offsetMs + word.durationMs) / 1000)),
      })),
    });

    const next = units[index + 1];
    if (next) {
      const pause = pauseAfterMs(level, next.speaker !== unit.speaker, unit.pauseAfterMs);
      const silence = new Int16Array(Math.round((pause / 1000) * sampleRate));
      pieces.push(silence);
      cursor += silence.length;
    }
  });

  const samples = new Int16Array(cursor);
  let offset = 0;
  for (const piece of pieces) {
    samples.set(piece, offset);
    offset += piece.length;
  }
  return { pcm: { sampleRate, samples }, units: timed, durationS: round3(cursor / sampleRate) };
}

const norm = (text: string) =>
  text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9']/g, '');

const isSpoken = (token: TokenT) => /[\p{L}\p{N}]/u.test(token.t);

/** Reparte un intervalo entre varios tokens en proporción a su longitud. */
function spread(tokens: TokenT[], start: number, end: number): void {
  const total = tokens.reduce((sum, token) => sum + Math.max(1, norm(token.t).length), 0);
  let cursor = start;
  for (const token of tokens) {
    const share = ((end - start) * Math.max(1, norm(token.t).length)) / total;
    token.s = round3(cursor);
    token.e = round3(cursor + share);
    cursor += share;
  }
}

/**
 * Asigna a cada token su tiempo en el audio a partir de los eventos de palabra del TTS.
 * El TTS agrupa distinto que el tokenizador («I'll» es un evento y dos tokens; «11:30» es un
 * token y dos eventos): se emparejan en orden y, si se pierde el hilo, el resto del segmento
 * se reparte en proporción a la longitud. La puntuación no tiene tiempo.
 */
export function alignTokens(tokens: readonly TokenT[], unit: TimedUnit): TokenT[] {
  const out = tokens.map((token) => {
    const copy = { ...token };
    delete copy.s;
    delete copy.e;
    return copy;
  });
  const spoken = out.filter(isSpoken);
  const events = unit.words.filter((word) => norm(word.text) !== '');
  if (spoken.length === 0) return out;
  if (events.length === 0) {
    spread(spoken, unit.start, unit.end);
    return out;
  }

  let t = 0;
  let e = 0;
  while (t < spoken.length && e < events.length) {
    const event = events[e] as TimedWord;
    const eventText = norm(event.text);

    // Caso 1: uno o varios tokens forman exactamente un evento («I» + «'ll» = «I'll»).
    let joined = '';
    let count = 0;
    while (t + count < spoken.length && joined.length < eventText.length) {
      joined += norm((spoken[t + count] as TokenT).t);
      count++;
    }
    if (joined === eventText) {
      spread(spoken.slice(t, t + count), event.s, event.e);
      t += count;
      e += 1;
      continue;
    }

    // Caso 2: un token ocupa varios eventos («11:30» → «eleven» «thirty»): se busca dónde
    // vuelve a coincidir el siguiente token y se le da todo lo que hay en medio.
    const nextText = spoken[t + 1] ? norm((spoken[t + 1] as TokenT).t) : null;
    let resync = -1;
    for (let k = e + 1; k < Math.min(events.length, e + 5) && nextText; k++) {
      if (norm((events[k] as TimedWord).text).startsWith(nextText)) {
        resync = k;
        break;
      }
    }
    if (resync > 0) {
      spread([spoken[t] as TokenT], event.s, (events[resync - 1] as TimedWord).e);
      t += 1;
      e = resync;
      continue;
    }
    break; // se perdió el hilo
  }

  if (t < spoken.length) {
    const previousEnd = t > 0 ? ((spoken[t - 1] as TokenT).e ?? unit.start) : unit.start;
    const from = events[e]?.s ?? previousEnd;
    spread(spoken.slice(t), Math.max(previousEnd, from), unit.end);
  }
  return out;
}

/** Picos de la onda normalizados (0–1), para dibujarla sin decodificar el audio en el cliente. */
export function computePeaks(samples: Int16Array, buckets = 240): number[] {
  if (samples.length === 0) return [];
  const count = Math.min(buckets, samples.length);
  const size = samples.length / count;
  const peaks: number[] = [];
  for (let b = 0; b < count; b++) {
    let max = 0;
    const end = Math.min(samples.length, Math.floor((b + 1) * size));
    for (let i = Math.floor(b * size); i < end; i++) {
      const value = Math.abs(samples[i] ?? 0);
      if (value > max) max = value;
    }
    peaks.push(max);
  }
  const top = Math.max(...peaks, 1);
  return peaks.map((peak) => Number((peak / top).toFixed(2)));
}

/** Palabras por minuto del audio, contando las pausas (así se percibe la velocidad). */
export function speechRate(wordCount: number, durationS: number): number {
  return durationS <= 0 ? 0 : Math.round((wordCount / durationS) * 60);
}

/** ¿Está la velocidad real dentro del ±8 % del objetivo? */
export function withinRateTolerance(actual: number, target: number, tolerance = 0.08): boolean {
  return Math.abs(actual - target) <= target * tolerance;
}
