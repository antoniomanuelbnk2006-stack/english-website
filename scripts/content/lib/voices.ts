import type { TtsProvider } from './tts/types';

// Voces de Azure por acento (docs/05-contenido/01-pipeline.md §4). Los nombres cambian con el
// tiempo: confírmalos en la galería de voces de Azure antes de un lote grande.

export const VOICES: Record<string, { female: string[]; male: string[] }> = {
  'en-US': {
    female: ['en-US-AvaNeural', 'en-US-EmmaNeural'],
    male: ['en-US-AndrewNeural', 'en-US-BrianNeural'],
  },
  'en-GB': {
    female: ['en-GB-SoniaNeural', 'en-GB-LibbyNeural'],
    male: ['en-GB-RyanNeural', 'en-GB-ThomasNeural'],
  },
  'en-AU': { female: ['en-AU-NatashaNeural'], male: ['en-AU-WilliamNeural'] },
  'en-IE': { female: ['en-IE-EmilyNeural'], male: ['en-IE-ConnorNeural'] },
  'en-CA': { female: ['en-CA-ClaraNeural'], male: ['en-CA-LiamNeural'] },
  'en-IN': { female: ['en-IN-NeerjaNeural'], male: ['en-IN-PrabhatNeural'] },
  'en-NZ': { female: ['en-NZ-MollyNeural'], male: ['en-NZ-MitchellNeural'] },
  'en-ZA': { female: ['en-ZA-LeahNeural'], male: ['en-ZA-LukeNeural'] },
  'en-NG': { female: ['en-NG-EzinneNeural'], male: ['en-NG-AbeoNeural'] },
};

export interface VoiceRequest {
  id: string;
  accent: string;
  gender: 'female' | 'male' | 'neutral';
  /** Voz fijada a mano en la lección. */
  voice?: string;
}

/** Número estable a partir de un texto: la misma lección elige siempre las mismas voces. */
function hash(text: string): number {
  let value = 0;
  for (const ch of text) value = (value * 31 + ch.charCodeAt(0)) >>> 0;
  return value;
}

/**
 * Asigna una voz a cada hablante. Dos hablantes de una lección nunca comparten voz, y entre
 * lecciones se rota para no oír siempre a las mismas personas.
 */
export function assignVoices(
  provider: TtsProvider,
  lessonId: string,
  speakers: readonly VoiceRequest[],
): Record<string, string> {
  const assigned: Record<string, string> = {};
  const used = new Set<string>();

  // Primero las fijadas a mano: tienen prioridad.
  for (const speaker of speakers) {
    if (!speaker.voice || provider.knowsVoice?.(speaker.voice) === false) continue;
    if (used.has(speaker.voice)) {
      throw new Error(`${lessonId}: dos hablantes comparten la voz ${speaker.voice}`);
    }
    assigned[speaker.id] = speaker.voice;
    used.add(speaker.voice);
  }

  for (const speaker of speakers) {
    if (assigned[speaker.id]) continue;
    const gender = speaker.gender === 'neutral' ? 'female' : speaker.gender;
    const candidates = provider.voicesFor(speaker.accent, gender);
    if (candidates.length === 0) {
      throw new Error(
        `${lessonId}: no hay voz sintética para ${speaker.accent} (${gender}); ese acento necesita audio auténtico`,
      );
    }
    const start = hash(`${lessonId}:${speaker.id}`) % candidates.length;
    const free = candidates
      .map((_, i) => candidates[(start + i) % candidates.length])
      .find((voice): voice is string => voice !== undefined && !used.has(voice));
    if (!free) {
      throw new Error(
        `${lessonId}: no quedan voces ${speaker.accent} (${gender}) sin usar para «${speaker.id}»`,
      );
    }
    assigned[speaker.id] = free;
    used.add(free);
  }
  return assigned;
}
