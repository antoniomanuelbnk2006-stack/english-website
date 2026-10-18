import { preferencesAllowed } from '@/features/consent/lib/browser';
import type { PracticeLanguage } from '@/lib/content/language';
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

/** La voz de cada idioma que no es inglés (el inglés tiene acentos: `voices.ts`). */
export const SPEECH_LANG: Record<Exclude<PracticeLanguage, 'en'>, string> = {
  es: 'es-ES',
  fr: 'fr-FR',
  zh: 'zh-CN',
  ja: 'ja-JP',
};

/** Una voz del navegador de ese idioma: la del mismo país si la hay, y si no, cualquiera. */
function pickVoiceFor(
  voices: SpeechSynthesisVoice[],
  tag: string,
): SpeechSynthesisVoice | undefined {
  const same = (voice: SpeechSynthesisVoice) => voice.lang.replace('_', '-').toLowerCase();
  return (
    voices.find((voice) => same(voice) === tag.toLowerCase()) ??
    voices.find((voice) => same(voice).startsWith(`${tag.slice(0, 2).toLowerCase()}-`))
  );
}

/**
 * Dice un texto con la voz del navegador: en inglés (con el acento elegido) o, con `language`, en
 * ese idioma. Devuelve `false` si no hay síntesis.
 */
export function speakText(
  text: string,
  options: { accent?: Accent; language?: PracticeLanguage; rate?: number; onEnd?: () => void } = {},
): boolean {
  if (!canSpeak()) return false;
  const other = options.language && options.language !== 'en' ? options.language : null;
  const accent = options.accent ?? storedAccent();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = other ? SPEECH_LANG[other] : accent;
  utterance.rate = options.rate ?? 0.92;
  const voices = window.speechSynthesis.getVoices();
  const voice = other ? pickVoiceFor(voices, SPEECH_LANG[other]) : pickVoice(voices, accent);
  if (voice) utterance.voice = voice;
  if (options.onEnd) {
    utterance.onend = options.onEnd;
    utterance.onerror = options.onEnd;
  }
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  return true;
}
