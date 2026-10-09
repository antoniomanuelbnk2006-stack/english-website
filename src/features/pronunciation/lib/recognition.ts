import type { Alternative } from './assess';
import type { Accent } from './voices';

// Reconocimiento de voz del navegador (Web Speech API), solo en el cliente. Chrome y Edge lo
// tienen; Firefox no. El audio lo procesa el servicio del propio navegador (ADR-0015): Señal no
// lo recibe ni lo guarda.

interface RecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}
interface RecognitionResult {
  readonly length: number;
  readonly [index: number]: RecognitionAlternative | undefined;
}
interface RecognitionEvent {
  readonly results: {
    readonly length: number;
    readonly [index: number]: RecognitionResult | undefined;
  };
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { readonly error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionConstructor = new () => Recognition;

function recognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const scope = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

export function canRecognize(): boolean {
  return recognitionConstructor() !== null;
}

export type ListenError = 'no-speech' | 'not-allowed' | 'no-microphone' | 'network' | 'unknown';

const ERRORS: Record<string, ListenError> = {
  'no-speech': 'no-speech',
  'not-allowed': 'not-allowed',
  'service-not-allowed': 'not-allowed',
  'audio-capture': 'no-microphone',
  network: 'network',
};

export interface ListenHandle {
  /** Deja de escuchar y valora lo dicho hasta ahora. */
  stop(): void;
  /** Deja de escuchar sin avisar a nadie (al salir de la pantalla). */
  cancel(): void;
}

/**
 * Escucha una sola intervención y devuelve las hipótesis del reconocedor, de más a menos
 * probable. Siempre termina llamando a `onResult` o a `onError`, una sola vez.
 */
export function listenOnce(options: {
  accent: Accent;
  onResult: (alternatives: Alternative[]) => void;
  onError: (error: ListenError) => void;
}): ListenHandle | null {
  const Constructor = recognitionConstructor();
  if (!Constructor) return null;

  const recognition = new Constructor();
  recognition.lang = options.accent;
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 5;

  let settled = false;
  const settle = (finish: () => void) => {
    if (settled) return;
    settled = true;
    finish();
  };

  recognition.onresult = (event) => {
    const result = event.results[event.results.length - 1];
    const alternatives: Alternative[] = [];
    for (let index = 0; index < (result?.length ?? 0); index++) {
      const alternative = result?.[index];
      if (alternative?.transcript.trim()) {
        alternatives.push({
          transcript: alternative.transcript.trim(),
          confidence: alternative.confidence,
        });
      }
    }
    settle(() =>
      alternatives.length > 0 ? options.onResult(alternatives) : options.onError('no-speech'),
    );
  };
  recognition.onerror = (event) => {
    if (event.error === 'aborted') return;
    settle(() => options.onError(ERRORS[event.error] ?? 'unknown'));
  };
  // Si termina sin resultado ni error, es que no se ha oído nada.
  recognition.onend = () => settle(() => options.onError('no-speech'));

  try {
    recognition.start();
  } catch {
    settle(() => options.onError('unknown'));
  }

  return {
    stop: () => recognition.stop(),
    cancel: () => {
      settled = true;
      recognition.abort();
    },
  };
}
