import { preferencesAllowed } from '@/features/consent/lib/browser';
import { ACCENTS, DEFAULT_ACCENT, pickVoice, type Accent } from './voices';

// Audio modelo con la voz del navegador (solo en el cliente). No hay ficheros de audio: una
// palabra suelta se pronuncia con la síntesis del sistema (docs/04-arquitectura/05-audio-y-reproductor.md).

const ACCENT_KEY = 'senal:accent';
const ACCENT_EVENT = 'senal:accent-change';

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** El acento elegido en esta visita, cuando no se puede guardar en el navegador. */
let visitAccent: Accent | null = null;

/**
 * Acento elegido para el audio modelo y el reconocimiento. Se recuerda en este navegador solo
 * con las cookies de preferencias aceptadas (ADR-0028); si no, vale para esta visita.
 */
export function storedAccent(): Accent {
  if (visitAccent) return visitAccent;
  try {
    const value = window.localStorage.getItem(ACCENT_KEY);
    return ACCENTS.find((accent) => accent === value) ?? DEFAULT_ACCENT;
  } catch {
    return DEFAULT_ACCENT;
  }
}

export function storeAccent(accent: Accent): void {
  visitAccent = accent;
  try {
    if (preferencesAllowed()) window.localStorage.setItem(ACCENT_KEY, accent);
  } catch {
    // Sin almacenamiento (modo privado estricto), el acento vale para esta visita.
  }
  window.dispatchEvent(new Event(ACCENT_EVENT));
}

export function subscribeAccent(onChange: () => void): () => void {
  window.addEventListener(ACCENT_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(ACCENT_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/** Dice un texto en inglés con la voz del navegador. Devuelve `false` si no hay síntesis. */
export function speakText(
  text: string,
  options: { accent?: Accent; rate?: number; onEnd?: () => void } = {},
): boolean {
  if (!canSpeak()) return false;
  const accent = options.accent ?? storedAccent();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = accent;
  utterance.rate = options.rate ?? 0.92;
  const voice = pickVoice(window.speechSynthesis.getVoices(), accent);
  if (voice) utterance.voice = voice;
  if (options.onEnd) {
    utterance.onend = options.onEnd;
    utterance.onerror = options.onEnd;
  }
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  return true;
}
