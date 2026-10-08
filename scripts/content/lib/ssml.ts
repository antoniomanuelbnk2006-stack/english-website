import type { Cefr } from './wordlists';

// SSML por segmento: voz, velocidad y estilo (docs/04-arquitectura/05-audio-y-reproductor.md §2).

/** Velocidad inicial según el nivel; luego se ajusta para acercarse a `target_wpm` (±8 %). */
export const INITIAL_RATE: Record<Cefr, number> = {
  A1: 0.85,
  A2: 0.9,
  B1: 0.95,
  B2: 1,
  C1: 1.05,
  C2: 1.1,
};

/** Azure admite de 0,5× a 2×; fuera de 0,7–1,3 la voz deja de sonar natural. */
export const MIN_RATE = 0.7;
export const MAX_RATE = 1.3;

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** `0.95` → `-5%`, `1.1` → `+10%`. */
export function ratePercent(rate: number): string {
  const percent = Math.round((rate - 1) * 100);
  return `${percent >= 0 ? '+' : ''}${percent}%`;
}

export function buildSsml({
  text,
  voice,
  rate,
  style,
}: {
  text: string;
  voice: string;
  rate: number;
  style?: string;
}): string {
  const lang = /^[a-z]{2}-[A-Z]{2}/.exec(voice)?.[0] ?? 'en-US';
  const spoken = `<prosody rate="${ratePercent(rate)}">${escapeXml(text)}</prosody>`;
  const styled = style
    ? `<mstts:express-as style="${escapeXml(style)}">${spoken}</mstts:express-as>`
    : spoken;
  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" ` +
    `xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${lang}">` +
    `<voice name="${escapeXml(voice)}">${styled}</voice></speak>`
  );
}

/** Lo inverso de `buildSsml`, para los proveedores que no entienden SSML: texto y velocidad. */
export function parseSsml(ssml: string): { text: string; rate: number } {
  const percent = /<prosody[^>]*rate="([+-]?\d+(?:\.\d+)?)%"/.exec(ssml)?.[1];
  const text = ssml
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  return { text, rate: 1 + Number(percent ?? 0) / 100 };
}
