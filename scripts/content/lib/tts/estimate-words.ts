import type { WordEvent } from './types';

// Tiempos por palabra estimados a partir del propio audio, para los TTS que no los dan
// (Kokoro). Las pausas de la voz se emparejan con la puntuación del texto y, dentro de cada
// tramo, las palabras se reparten en proporción a su longitud. Es una aproximación: sirve para
// el karaoke; los tiempos exactos solo los da un TTS con eventos de palabra (Azure).
// Lógica pura.

const FRAME_MS = 10;
/** Un silencio más corto que esto es parte de la articulación, no una pausa. */
const MIN_PAUSE_MS = 140;

interface Region {
  startMs: number;
  endMs: number;
}

interface Word {
  text: string;
  weight: number;
  /** ¿Hay un signo de puntuación (posible pausa) después? */
  breakAfter: boolean;
}

function splitWords(text: string): Word[] {
  const words: Word[] = [];
  for (const piece of text.split(/\s+/).filter(Boolean)) {
    const letters = piece.replace(/[^\p{L}\p{N}']/gu, '');
    if (letters === '') {
      // Un guion suelto o unos puntos suspensivos: marcan pausa tras la palabra anterior.
      const previous = words.at(-1);
      if (previous) previous.breakAfter = true;
      continue;
    }
    words.push({
      text: piece.replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, ''),
      // Cada palabra cuesta un mínimo de tiempo aunque sea muy corta.
      weight: letters.length + 1,
      breakAfter: /[.,!?;:…—–]["')\]]*$/.test(piece),
    });
  }
  return words;
}

/** Tramos con voz, separados por silencios de al menos `MIN_PAUSE_MS`. */
export function voicedRegions(samples: Int16Array, sampleRate: number): Region[] {
  const frame = Math.max(1, Math.round((FRAME_MS / 1000) * sampleRate));
  const frames = Math.ceil(samples.length / frame);
  let peak = 0;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i] ?? 0));
  const threshold = Math.max(120, peak * 0.03);

  const voiced: boolean[] = [];
  for (let f = 0; f < frames; f++) {
    let max = 0;
    const end = Math.min(samples.length, (f + 1) * frame);
    for (let i = f * frame; i < end; i++) max = Math.max(max, Math.abs(samples[i] ?? 0));
    voiced.push(max >= threshold);
  }

  const regions: Region[] = [];
  let start = -1;
  let silence = 0;
  for (let f = 0; f < frames; f++) {
    if (voiced[f]) {
      if (start < 0) start = f;
      silence = 0;
    } else if (start >= 0) {
      silence++;
      if (silence * FRAME_MS >= MIN_PAUSE_MS) {
        regions.push({ startMs: start * FRAME_MS, endMs: (f - silence + 1) * FRAME_MS });
        start = -1;
        silence = 0;
      }
    }
  }
  if (start >= 0) regions.push({ startMs: start * FRAME_MS, endMs: (frames - silence) * FRAME_MS });
  return regions;
}

function spread(words: readonly Word[], startMs: number, endMs: number): WordEvent[] {
  const total = words.reduce((sum, word) => sum + word.weight, 0);
  let cursor = startMs;
  return words.map((word) => {
    const durationMs = ((endMs - startMs) * word.weight) / total;
    const event = { text: word.text, offsetMs: Math.round(cursor), durationMs: Math.round(durationMs) };
    cursor += durationMs;
    return event;
  });
}

export function estimateWordEvents(
  samples: Int16Array,
  sampleRate: number,
  text: string,
): WordEvent[] {
  const words = splitWords(text);
  if (words.length === 0) return [];
  let regions = voicedRegions(samples, sampleRate);
  if (regions.length === 0) {
    return spread(words, 0, (samples.length / sampleRate) * 1000);
  }

  // Grupos de palabras entre signos de puntuación.
  const groups: Word[][] = [[]];
  for (const word of words) {
    (groups.at(-1) as Word[]).push(word);
    if (word.breakAfter) groups.push([]);
  }
  if ((groups.at(-1) as Word[]).length === 0) groups.pop();

  // Más tramos de voz que grupos: sobran pausas (dudas, oclusivas largas). Se funden las más
  // cortas hasta que cada grupo tenga su tramo.
  while (regions.length > groups.length) {
    let shortest = 1;
    for (let i = 2; i < regions.length; i++) {
      const gap = (regions[i] as Region).startMs - (regions[i - 1] as Region).endMs;
      const best = (regions[shortest] as Region).startMs - (regions[shortest - 1] as Region).endMs;
      if (gap < best) shortest = i;
    }
    const merged = {
      startMs: (regions[shortest - 1] as Region).startMs,
      endMs: (regions[shortest] as Region).endMs,
    };
    regions = [...regions.slice(0, shortest - 1), merged, ...regions.slice(shortest + 1)];
  }

  if (regions.length === groups.length) {
    return groups.flatMap((group, index) => {
      const region = regions[index] as Region;
      return spread(group, region.startMs, region.endMs);
    });
  }

  // Menos pausas que signos de puntuación (comas dichas de corrido): todo el tramo con voz se
  // reparte de una vez.
  return spread(words, (regions[0] as Region).startMs, (regions.at(-1) as Region).endMs);
}
