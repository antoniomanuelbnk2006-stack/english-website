import type { WritingFeedback } from './schema';

// Contrato de `POST /api/ai/writing-feedback`, compartido por el servidor y el navegador.

export type WritingFeedbackError =
  | 'forbidden'
  | 'unauthorized'
  | 'ai_disabled'
  | 'invalid_body'
  | 'not_found'
  | 'daily_limit'
  | 'monthly_budget'
  | 'db'
  | 'ai_failed'
  | 'ai_refused'
  | 'ai_truncated';

export const FEEDBACK_STATUS: Record<WritingFeedbackError, number> = {
  forbidden: 403,
  unauthorized: 401,
  ai_disabled: 503,
  invalid_body: 400,
  not_found: 404,
  daily_limit: 429,
  monthly_budget: 429,
  db: 500,
  ai_failed: 502,
  ai_refused: 502,
  ai_truncated: 502,
};

export interface WritingFeedbackResponse {
  id: string;
  feedback: WritingFeedback;
  /** `false` si la corrección no se ha podido guardar en el historial. */
  saved: boolean;
  /** La respuesta modelo: solo sale del servidor después de entregar. */
  modelAnswer: string;
  /** Errores recurrentes que se pueden pasar al repaso. */
  cards: { front: string; back: string }[];
}

const ERRORS = new Set<string>(Object.keys(FEEDBACK_STATUS));

/** El código de error de una respuesta fallida; cualquier cosa rara cuenta como fallo de la IA. */
export function feedbackErrorOf(body: unknown): WritingFeedbackError {
  const error =
    typeof body === 'object' && body !== null ? (body as { error?: unknown }).error : undefined;
  return typeof error === 'string' && ERRORS.has(error)
    ? (error as WritingFeedbackError)
    : 'ai_failed';
}
