// Voz del navegador para el audio modelo (Web Speech API). Lógica pura.

export const ACCENTS = ['en-GB', 'en-US'] as const;
export type Accent = (typeof ACCENTS)[number];
export const DEFAULT_ACCENT: Accent = 'en-GB';

export interface VoiceLike {
  name: string;
  lang: string;
}

const tag = (lang: string) => lang.replace('_', '-').toLowerCase();

/**
 * La mejor voz inglesa disponible para el acento pedido: primero las del acento exacto y,
 * dentro de ellas, las neuronales («Natural», «Online») antes que las sintéticas clásicas.
 * Devuelve `null` si el sistema no tiene ninguna voz en inglés.
 */
export function pickVoice<T extends VoiceLike>(voices: readonly T[], accent: Accent): T | null {
  const score = (voice: T) =>
    (tag(voice.lang) === accent.toLowerCase() ? 4 : 0) +
    (/natural|neural|online/i.test(voice.name) ? 2 : 0) +
    (/google/i.test(voice.name) ? 1 : 0);
  const english = voices.filter((voice) => tag(voice.lang).startsWith('en'));
  let best: T | null = null;
  for (const voice of english) {
    if (!best || score(voice) > score(best)) best = voice;
  }
  return best;
}
