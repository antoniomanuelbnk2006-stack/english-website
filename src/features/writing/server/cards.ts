import 'server-only';
import { feedbackCards, hintCards, type CardCandidate } from '@/features/writing/lib/cards';
import { findHints, isFormal } from '@/features/writing/lib/checks';
import type { StoredFeedback } from '@/features/writing/lib/schema';
import { findWritingPrompt } from '@/lib/content/writing';
import { WritingTaskType } from '@/lib/content/writing-schema';
import { FALLBACK_LOCALE } from '@/lib/i18n';
import { languageOfId } from '@/lib/content/language';

/**
 * Tarjetas de repaso que se pueden sacar de una entrega. Se calculan siempre en el servidor a
 * partir de lo guardado: el navegador solo dice cuáles quiere, por su posición.
 */
export function cardCandidates(submission: {
  id: string;
  text: string;
  promptId: string | null;
  taskType: string;
  feedback: StoredFeedback | null;
}): CardCandidate[] {
  // Solo hace falta el título de la consigna, que no depende del idioma de la interfaz.
  const prompt = submission.promptId
    ? findWritingPrompt(submission.promptId, FALLBACK_LOCALE)
    : null;
  const source = { submissionId: submission.id, title: prompt?.title ?? submission.taskType };

  if (submission.feedback?.kind === 'ai') {
    return feedbackCards(submission.feedback.feedback, source);
  }
  const taskType = WritingTaskType.safeParse(submission.taskType);
  const formal = taskType.success && isFormal(taskType.data);
  const language = languageOfId(submission.promptId ?? '');
  return hintCards(submission.text, findHints(submission.text, { formal, language }), source);
}

/** Lo que se enseña de cada tarjeta propuesta. */
export const toOffer = (candidates: readonly CardCandidate[]) =>
  candidates.map(({ front, back }) => ({ front, back }));
